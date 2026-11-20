import { SupabaseClient } from '@supabase/supabase-js';

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface LedgerAccount {
  id: string;
  company_id: string;
  code: string;
  name: string;
  account_type: AccountType;
  subtype: string | null;
  is_system: boolean;
  is_active: boolean;
}

/** Ethiopian SME chart of accounts used when a company first opens the ledger. */
export const DEFAULT_CHART_OF_ACCOUNTS: Array<{
  code: string;
  name: string;
  account_type: AccountType;
  subtype?: string;
}> = [
  { code: '1000', name: 'Cash on Hand', account_type: 'asset', subtype: 'cash' },
  { code: '1010', name: 'Bank Account', account_type: 'asset', subtype: 'bank' },
  { code: '1100', name: 'Accounts Receivable', account_type: 'asset', subtype: 'receivable' },
  { code: '1150', name: 'Withholding Tax Receivable', account_type: 'asset', subtype: 'tax' },
  { code: '1300', name: 'VAT Input (Recoverable)', account_type: 'asset', subtype: 'tax' },
  { code: '2000', name: 'Accounts Payable', account_type: 'liability', subtype: 'payable' },
  { code: '2100', name: 'VAT Output (Payable)', account_type: 'liability', subtype: 'tax' },
  { code: '2150', name: 'Withholding Tax Payable', account_type: 'liability', subtype: 'tax' },
  { code: '2160', name: 'Turnover Tax Payable', account_type: 'liability', subtype: 'tax' },
  { code: '2200', name: 'Pension Payable', account_type: 'liability', subtype: 'payroll' },
  { code: '3000', name: "Owner's Capital", account_type: 'equity' },
  { code: '3100', name: 'Retained Earnings', account_type: 'equity' },
  { code: '4000', name: 'Sales Revenue', account_type: 'income' },
  { code: '4100', name: 'Service Revenue', account_type: 'income' },
  { code: '4200', name: 'Other Income', account_type: 'income' },
  { code: '5000', name: 'Cost of Goods Sold', account_type: 'expense' },
  { code: '5100', name: 'Purchases — Goods', account_type: 'expense' },
  { code: '5200', name: 'Services & Subcontracting', account_type: 'expense' },
  { code: '5300', name: 'Salaries & Wages', account_type: 'expense' },
  { code: '5400', name: 'Rent Expense', account_type: 'expense' },
  { code: '5500', name: 'Utilities Expense', account_type: 'expense' },
  { code: '5600', name: 'Other Operating Expenses', account_type: 'expense' },
];

export const ACCOUNT_CODES = {
  bank: '1010',
  cash: '1000',
  whtReceivable: '1150',
  vatInput: '1300',
  vatOutput: '2100',
  whtPayable: '2150',
  totPayable: '2160',
  sales: '4000',
  serviceRevenue: '4100',
  purchases: '5100',
  services: '5200',
} as const;

const r2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

export async function ensureChartOfAccounts(
  admin: SupabaseClient,
  companyId: string
): Promise<Map<string, LedgerAccount>> {
  const { data: existing, error } = await admin
    .from('ledger_accounts')
    .select('*')
    .eq('company_id', companyId);

  if (error) throw new Error(`Could not load chart of accounts: ${error.message}`);

  const byCode = new Map<string, LedgerAccount>((existing ?? []).map((a: LedgerAccount) => [a.code, a]));
  const missing = DEFAULT_CHART_OF_ACCOUNTS.filter((account) => !byCode.has(account.code));

  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await admin
      .from('ledger_accounts')
      .insert(
        missing.map((account) => ({
          company_id: companyId,
          code: account.code,
          name: account.name,
          account_type: account.account_type,
          subtype: account.subtype ?? null,
          is_system: true,
        }))
      )
      .select();

    if (insertError) throw new Error(`Could not seed chart of accounts: ${insertError.message}`);
    for (const account of inserted ?? []) byCode.set(account.code, account as LedgerAccount);
  }

  return byCode;
}

export interface ReceiptForPosting {
  id: string;
  company_id: string;
  license_id: string | null;
  invoice_date: string | null;
  fs_number: string | null;
  partner_name: string | null;
  receipt_type: string | null;
  supply_type: string | null;
  vat_treatment: string | null;
  untaxed_amount: number | null;
  vat_amount: number | null;
  wht_amount: number | null;
  total_amount: number | null;
}

export interface PostingLine {
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
  partner_name?: string | null;
}

/**
 * Builds the double-entry lines for a receipt.
 *
 * Sale:    Dr Bank, Dr WHT receivable, Cr Revenue, Cr VAT output, Cr TOT payable
 * Purchase: Dr Purchases/Services, Dr VAT input, Cr Bank (net of WHT), Cr WHT payable
 */
export function buildReceiptPosting(receipt: ReceiptForPosting): {
  lines: PostingLine[];
  totalDebit: number;
  totalCredit: number;
} {
  const untaxed = Math.max(0, r2(receipt.untaxed_amount ?? 0));
  const treatment = receipt.vat_treatment || 'standard';
  const vat =
    treatment === 'standard' || treatment === 'unknown'
      ? Math.max(0, r2(receipt.vat_amount ?? 0))
      : 0;
  const totTax = treatment === 'tot' ? r2(untaxed * 0.02) : 0;
  const wht = Math.max(0, r2(receipt.wht_amount ?? 0));
  const isSale = receipt.receipt_type === 'sale';
  const label = receipt.partner_name ? ` — ${receipt.partner_name}` : '';
  const reference = receipt.fs_number ? `FS ${receipt.fs_number}` : receipt.id.slice(0, 8);

  const lines: PostingLine[] = [];

  if (isSale) {
    const cash = r2(untaxed + vat + totTax - wht);
    if (cash > 0) {
      lines.push({ accountCode: ACCOUNT_CODES.bank, debit: cash, credit: 0, description: `Sale receipt ${reference}${label}`, partner_name: receipt.partner_name });
    }
    if (wht > 0) {
      lines.push({ accountCode: ACCOUNT_CODES.whtReceivable, debit: wht, credit: 0, description: `WHT withheld by customer ${reference}` });
    }
    if (untaxed > 0) {
      const revenueCode = receipt.supply_type === 'services' ? ACCOUNT_CODES.serviceRevenue : ACCOUNT_CODES.sales;
      lines.push({ accountCode: revenueCode, debit: 0, credit: untaxed, description: `Sale ${reference}${label}`, partner_name: receipt.partner_name });
    }
    if (vat > 0) {
      lines.push({ accountCode: ACCOUNT_CODES.vatOutput, debit: 0, credit: vat, description: `VAT on sale ${reference}` });
    }
    if (totTax > 0) {
      lines.push({ accountCode: ACCOUNT_CODES.totPayable, debit: 0, credit: totTax, description: `Turnover tax on sale ${reference}` });
    }
  } else {
    const expenseCode = receipt.supply_type === 'services' ? ACCOUNT_CODES.services : ACCOUNT_CODES.purchases;
    const cash = r2(untaxed + vat - wht);
    if (untaxed > 0) {
      lines.push({ accountCode: expenseCode, debit: untaxed, credit: 0, description: `Purchase ${reference}${label}`, partner_name: receipt.partner_name });
    }
    if (vat > 0) {
      lines.push({ accountCode: ACCOUNT_CODES.vatInput, debit: vat, credit: 0, description: `VAT input ${reference}` });
    }
    if (cash > 0) {
      lines.push({ accountCode: ACCOUNT_CODES.bank, debit: 0, credit: cash, description: `Payment for ${reference}${label}`, partner_name: receipt.partner_name });
    }
    if (wht > 0) {
      lines.push({ accountCode: ACCOUNT_CODES.whtPayable, debit: 0, credit: wht, description: `WHT withheld from ${reference}` });
    }
  }

  // Never post an unbalanced entry — fall back to a cash plug for rounding.
  let totalDebit = r2(lines.reduce((sum, line) => sum + line.debit, 0));
  let totalCredit = r2(lines.reduce((sum, line) => sum + line.credit, 0));
  const difference = r2(totalDebit - totalCredit);
  if (difference !== 0) {
    if (difference > 0) {
      lines.push({ accountCode: ACCOUNT_CODES.bank, debit: 0, credit: difference, description: 'Rounding adjustment' });
    } else {
      lines.push({ accountCode: ACCOUNT_CODES.bank, debit: Math.abs(difference), credit: 0, description: 'Rounding adjustment' });
    }
    totalDebit = r2(lines.reduce((sum, line) => sum + line.debit, 0));
    totalCredit = r2(lines.reduce((sum, line) => sum + line.credit, 0));
  }

  return { lines, totalDebit, totalCredit };
}

export async function postReceiptToLedger(
  admin: SupabaseClient,
  receipt: ReceiptForPosting,
  userId?: string | null
): Promise<{ posted: boolean; entryId?: string; reason?: string }> {
  const { data: existing, error: existingError } = await admin
    .from('journal_entries')
    .select('id')
    .eq('company_id', receipt.company_id)
    .eq('source', 'receipt')
    .eq('source_id', receipt.id)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    return { posted: false, reason: existingError.message };
  }
  if (existing) return { posted: false, reason: 'already-posted' };

  const total = r2((receipt.untaxed_amount ?? 0) + (receipt.vat_amount ?? 0));
  if (total <= 0) return { posted: false, reason: 'no-amount' };

  const accounts = await ensureChartOfAccounts(admin, receipt.company_id);
  const { lines, totalDebit, totalCredit } = buildReceiptPosting(receipt);
  if (lines.length === 0) return { posted: false, reason: 'nothing-to-post' };
  if (r2(totalDebit) !== r2(totalCredit)) {
    return { posted: false, reason: 'unbalanced' };
  }

  const entryDate = receipt.invoice_date || new Date().toISOString().slice(0, 10);
  const { data: entry, error: entryError } = await admin
    .from('journal_entries')
    .insert({
      company_id: receipt.company_id,
      license_id: receipt.license_id,
      entry_date: entryDate,
      reference: receipt.fs_number ? `FS ${receipt.fs_number}` : null,
      description: `${receipt.receipt_type === 'sale' ? 'Sales' : 'Purchase'} receipt${receipt.partner_name ? ` — ${receipt.partner_name}` : ''}`,
      source: 'receipt',
      source_id: receipt.id,
      status: 'posted',
      total_debit: totalDebit,
      total_credit: totalCredit,
      created_by: userId || null,
    })
    .select('id')
    .single();

  if (entryError || !entry) {
    return { posted: false, reason: entryError?.message || 'entry-insert-failed' };
  }

  const rows = lines.map((line) => {
    const account = accounts.get(line.accountCode);
    return {
      entry_id: entry.id,
      company_id: receipt.company_id,
      account_id: account?.id,
      description: line.description,
      partner_name: line.partner_name ?? null,
      debit: line.debit,
      credit: line.credit,
    };
  });

  if (rows.some((row) => !row.account_id)) {
    await admin.from('journal_entries').delete().eq('id', entry.id);
    return { posted: false, reason: 'missing-account' };
  }

  const { error: linesError } = await admin.from('journal_lines').insert(rows);
  if (linesError) {
    await admin.from('journal_entries').delete().eq('id', entry.id);
    return { posted: false, reason: linesError.message };
  }

  return { posted: true, entryId: entry.id };
}

export function applyLicenseFilter(query: any, licenseId?: string | null) {
  if (!licenseId || licenseId === 'all') return query;
  if (licenseId === 'main') return query.or('license_id.is.null,license_id.eq.main');
  return query.eq('license_id', licenseId);
}

export async function syncReceiptsToLedger(
  admin: SupabaseClient,
  options: {
    companyId: string;
    licenseId?: string | null;
    from?: string | null;
    to?: string | null;
    userId?: string | null;
  }
): Promise<{ posted: number; skipped: number; failed: number }> {
  let query = admin
    .from('receipt_intakes')
    .select('*')
    .eq('company_id', options.companyId)
    .neq('state', 'cancelled');

  query = applyLicenseFilter(query, options.licenseId);
  if (options.from) query = query.gte('invoice_date', options.from);
  if (options.to) query = query.lte('invoice_date', options.to);

  const { data: receipts, error } = await query;
  if (error) throw new Error(error.message);

  let posted = 0;
  let skipped = 0;
  let failed = 0;

  for (const receipt of receipts ?? []) {
    try {
      const result = await postReceiptToLedger(
        admin,
        { ...receipt, company_id: options.companyId },
        options.userId
      );
      if (result.posted) posted += 1;
      else if (result.reason === 'already-posted' || result.reason === 'no-amount') skipped += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }

  return { posted, skipped, failed };
}

export interface LedgerReportOptions {
  companyId: string;
  licenseId?: string | null;
  from: string;
  to: string;
}

export interface LedgerReport {
  range: { from: string; to: string };
  accounts: Array<{
    code: string;
    name: string;
    type: AccountType;
    debit: number;
    credit: number;
    balance: number;
  }>;
  trialBalance: {
    rows: Array<{ code: string; name: string; type: AccountType; debit: number; credit: number }>;
    totalDebit: number;
    totalCredit: number;
  };
  profitAndLoss: {
    income: Array<{ code: string; name: string; amount: number }>;
    expenses: Array<{ code: string; name: string; amount: number }>;
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
  balanceSheet: {
    assets: Array<{ code: string; name: string; amount: number }>;
    liabilities: Array<{ code: string; name: string; amount: number }>;
    equity: Array<{ code: string; name: string; amount: number }>;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
    retainedEarnings: number;
  };
  vatReturn: {
    outputVat: number;
    inputVat: number;
    turnoverTax: number;
    netPayable: number;
  };
  whtSchedule: Array<{
    date: string | null;
    fs_number: string | null;
    partner_name: string | null;
    partner_tin: string | null;
    untaxed_amount: number;
    wht_rate: number;
    wht_amount: number;
  }>;
  journal: Array<{
    id: string;
    date: string;
    reference: string | null;
    description: string | null;
    source: string;
    totalDebit: number;
    totalCredit: number;
    lines: Array<{ account: string; description: string | null; debit: number; credit: number }>;
  }>;
  unpostedReceipts: number;
}

export async function buildLedgerReport(
  admin: SupabaseClient,
  options: LedgerReportOptions
): Promise<LedgerReport> {
  const accountsMap = await ensureChartOfAccounts(admin, options.companyId);
  const accounts = Array.from(accountsMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  const accountById = new Map(accounts.map((account) => [account.id, account]));

  const entryQuery = applyLicenseFilter(
    admin
      .from('journal_entries')
      .select('id, entry_date, reference, description, source, total_debit, total_credit, status')
      .eq('company_id', options.companyId)
      .neq('status', 'void')
      .gte('entry_date', options.from)
      .lte('entry_date', options.to)
      .order('entry_date', { ascending: false })
      .limit(5000),
    options.licenseId
  );
  const { data: entries, error: entriesError } = await entryQuery;
  if (entriesError) throw new Error(entriesError.message);

  const entryIds = (entries ?? []).map((entry: any) => entry.id);
  let lines: any[] = [];
  if (entryIds.length > 0) {
    const { data, error } = await admin
      .from('journal_lines')
      .select('entry_id, account_id, description, debit, credit')
      .in('entry_id', entryIds);
    if (error) throw new Error(error.message);
    lines = data ?? [];
  }

  const totalsByAccount = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    const current = totalsByAccount.get(line.account_id) ?? { debit: 0, credit: 0 };
    current.debit = r2(current.debit + Number(line.debit || 0));
    current.credit = r2(current.credit + Number(line.credit || 0));
    totalsByAccount.set(line.account_id, current);
  }

  const accountRows = accounts.map((account) => {
    const totals = totalsByAccount.get(account.id) ?? { debit: 0, credit: 0 };
    return {
      code: account.code,
      name: account.name,
      type: account.account_type,
      debit: totals.debit,
      credit: totals.credit,
      balance: r2(totals.debit - totals.credit),
    };
  });

  const trialRows = accountRows
    .filter((row) => row.debit !== 0 || row.credit !== 0)
    .map((row) => ({ code: row.code, name: row.name, type: row.type, debit: row.debit, credit: row.credit }));

  const income = accountRows
    .filter((row) => row.type === 'income')
    .map((row) => ({ code: row.code, name: row.name, amount: r2(row.credit - row.debit) }));
  const expenses = accountRows
    .filter((row) => row.type === 'expense')
    .map((row) => ({ code: row.code, name: row.name, amount: r2(row.debit - row.credit) }));
  const totalIncome = r2(income.reduce((sum, row) => sum + row.amount, 0));
  const totalExpenses = r2(expenses.reduce((sum, row) => sum + row.amount, 0));

  const assets = accountRows
    .filter((row) => row.type === 'asset')
    .map((row) => ({ code: row.code, name: row.name, amount: r2(row.debit - row.credit) }));
  const liabilities = accountRows
    .filter((row) => row.type === 'liability')
    .map((row) => ({ code: row.code, name: row.name, amount: r2(row.credit - row.debit) }));
  const equity = accountRows
    .filter((row) => row.type === 'equity')
    .map((row) => ({ code: row.code, name: row.name, amount: r2(row.credit - row.debit) }));

  const vatAccount = accountsMap.get(ACCOUNT_CODES.vatOutput);
  const vatInputAccount = accountsMap.get(ACCOUNT_CODES.vatInput);
  const totAccount = accountsMap.get(ACCOUNT_CODES.totPayable);
  const vatOutput = r2(totalsByAccount.get(vatAccount?.id || '')?.credit ?? 0);
  const vatInput = r2(totalsByAccount.get(vatInputAccount?.id || '')?.debit ?? 0);
  const turnoverTax = r2(totalsByAccount.get(totAccount?.id || '')?.credit ?? 0);

  let whtQuery = admin
    .from('receipt_intakes')
    .select('invoice_date, fs_number, partner_name, partner_tin, untaxed_amount, wht_rate, wht_amount, receipt_type')
    .eq('company_id', options.companyId)
    .eq('receipt_type', 'purchase')
    .neq('state', 'cancelled')
    .gte('invoice_date', options.from)
    .lte('invoice_date', options.to)
    .order('invoice_date', { ascending: false })
    .limit(500);
  whtQuery = applyLicenseFilter(whtQuery, options.licenseId);
  const { data: whtRows } = await whtQuery;

  let unpostedQuery = admin
    .from('receipt_intakes')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', options.companyId)
    .neq('state', 'cancelled')
    .gte('invoice_date', options.from)
    .lte('invoice_date', options.to);
  unpostedQuery = applyLicenseFilter(unpostedQuery, options.licenseId);
  const { count: receiptCount } = await unpostedQuery;

  const postedSourceIds = new Set<string>();
  if (entryIds.length > 0) {
    const { data: sourceRows } = await admin
      .from('journal_entries')
      .select('source_id')
      .eq('company_id', options.companyId)
      .eq('source', 'receipt')
      .in('id', entryIds);
    for (const row of sourceRows ?? []) if (row.source_id) postedSourceIds.add(row.source_id);
  }

  const linesByEntry = new Map<string, any[]>();
  for (const line of lines) {
    const list = linesByEntry.get(line.entry_id) ?? [];
    list.push(line);
    linesByEntry.set(line.entry_id, list);
  }

  const journal = (entries ?? []).slice(0, 500).map((entry: any) => ({
    id: entry.id,
    date: entry.entry_date,
    reference: entry.reference,
    description: entry.description,
    source: entry.source,
    totalDebit: r2(Number(entry.total_debit || 0)),
    totalCredit: r2(Number(entry.total_credit || 0)),
    lines: (linesByEntry.get(entry.id) ?? []).map((line: any) => {
      const account = accountById.get(line.account_id);
      return {
        account: account ? `${account.code} ${account.name}` : 'Unknown account',
        description: line.description,
        debit: r2(Number(line.debit || 0)),
        credit: r2(Number(line.credit || 0)),
      };
    }),
  }));

  return {
    range: { from: options.from, to: options.to },
    accounts: accountRows,
    trialBalance: {
      rows: trialRows,
      totalDebit: r2(trialRows.reduce((sum, row) => sum + row.debit, 0)),
      totalCredit: r2(trialRows.reduce((sum, row) => sum + row.credit, 0)),
    },
    profitAndLoss: {
      income: income.filter((row) => row.amount !== 0),
      expenses: expenses.filter((row) => row.amount !== 0),
      totalIncome,
      totalExpenses,
      netProfit: r2(totalIncome - totalExpenses),
    },
    balanceSheet: {
      assets: assets.filter((row) => row.amount !== 0),
      liabilities: liabilities.filter((row) => row.amount !== 0),
      equity: equity.filter((row) => row.amount !== 0),
      totalAssets: r2(assets.reduce((sum, row) => sum + row.amount, 0)),
      totalLiabilities: r2(liabilities.reduce((sum, row) => sum + row.amount, 0)),
      totalEquity: r2(equity.reduce((sum, row) => sum + row.amount, 0)),
      retainedEarnings: r2(totalIncome - totalExpenses),
    },
    vatReturn: {
      outputVat: vatOutput,
      inputVat: vatInput,
      turnoverTax,
      netPayable: r2(vatOutput - vatInput),
    },
    whtSchedule: (whtRows ?? [])
      .filter((row) => Number(row.wht_amount || 0) > 0)
      .map((row) => ({
        date: row.invoice_date,
        fs_number: row.fs_number,
        partner_name: row.partner_name,
        partner_tin: row.partner_tin,
        untaxed_amount: r2(Number(row.untaxed_amount || 0)),
        wht_rate: Number(row.wht_rate || 0),
        wht_amount: r2(Number(row.wht_amount || 0)),
      })),
    journal,
    unpostedReceipts: Math.max(0, Number(receiptCount || 0) - postedSourceIds.size),
  };
}
