import { NextRequest, NextResponse } from 'next/server';
import { authenticate, getMemberships } from '@/lib/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { postReceiptToLedger, applyLicenseFilter } from '@/lib/ledger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

function monthRange(month: string | null): { from: string; to: string } | null {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [year, mon] = month.split('-').map(Number);
  if (mon < 1 || mon > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const mm = String(mon).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(daysInMonth).padStart(2, '0')}` };
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function summarize(rows: any[]) {
  const active = rows.filter((row) => row.state !== 'cancelled');

  const bucket = (list: any[]) => ({
    count: list.length,
    untaxed: round2(list.reduce((sum, row) => sum + Number(row.untaxed_amount || 0), 0)),
    vat: round2(list.reduce((sum, row) => sum + Number(row.vat_amount || 0), 0)),
    wht: round2(list.reduce((sum, row) => sum + Number(row.wht_amount || 0), 0)),
    total: round2(list.reduce((sum, row) => sum + Number(row.total_amount || 0), 0)),
    byState: {
      registered: list.filter((row) => row.state === 'registered').length,
      draft: list.filter((row) => row.state === 'draft' || row.state === 'ocr_done').length,
      cancelled: list.filter((row) => row.state === 'cancelled').length,
    },
  });

  return {
    sales: bucket(active.filter((row) => row.receipt_type === 'sale')),
    purchases: bucket(active.filter((row) => row.receipt_type === 'purchase')),
    byState: bucket(rows).byState,
  };
}

function growth(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const params = req.nextUrl.searchParams;
    const memberships = await getMemberships(ctx);
    const companyId =
      (ctx.isPlatformAdmin ? params.get('company_id') : null) || memberships[0]?.company_id || null;
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company associated with this account. Select a company to view its receipts.' },
        { status: 403 }
      );
    }

    const licenseId = params.get('license_id');
    const month = params.get('month');
    const type = params.get('type');
    const explicitFrom = params.get('from');
    const explicitTo = params.get('to');

    const range = explicitFrom && explicitTo ? { from: explicitFrom, to: explicitTo } : monthRange(month);
    const admin = createAdminSupabase();

    const fetchRange = async (from: string, to: string) => {
      const build = (withLicense: boolean) => {
        let query = admin
          .from('receipt_intakes')
          .select('*')
          .eq('company_id', companyId)
          .gte('invoice_date', from)
          .lte('invoice_date', to)
          .order('invoice_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(1000);
        if (withLicense) query = applyLicenseFilter(query, licenseId);
        return query;
      };
      const { data, error } = await build(true);
      if (!error) return data ?? [];
      // Before migration 0004 the license_id column does not exist: degrade to company-wide.
      if (/license_id/i.test(error.message)) {
        const retry = await build(false);
        if (retry.error) throw new Error(retry.error.message);
        return retry.data ?? [];
      }
      throw new Error(error.message);
    };

    const rows = range ? await fetchRange(range.from, range.to) : [];

    let previousSummary: ReturnType<typeof summarize> | null = null;
    if (month && !explicitFrom) {
      const previousMonth = shiftMonth(month, -1);
      const previousRange = monthRange(previousMonth);
      if (previousRange) {
        previousSummary = summarize(await fetchRange(previousRange.from, previousRange.to));
      }
    }

    const summary = summarize(rows);
    const salesGrowth = previousSummary ? growth(summary.sales.total, previousSummary.sales.total) : null;
    const purchaseGrowth = previousSummary ? growth(summary.purchases.total, previousSummary.purchases.total) : null;

    let daily: any[] = [];
    if (range) {
      const start = new Date(`${range.from}T00:00:00Z`);
      const end = new Date(`${range.to}T00:00:00Z`);
      const days: any[] = [];
      for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
        days.push({
          date: cursor.toISOString().slice(0, 10),
          sales: 0,
          purchases: 0,
          salesCount: 0,
          purchaseCount: 0,
        });
      }
      const byDate = new Map(days.map((day) => [day.date, day]));
      for (const row of rows) {
        const day = byDate.get(row.invoice_date);
        if (!day || row.state === 'cancelled') continue;
        if (row.receipt_type === 'sale') {
          day.sales = round2(day.sales + Number(row.total_amount || 0));
          day.salesCount += 1;
        } else {
          day.purchases = round2(day.purchases + Number(row.total_amount || 0));
          day.purchaseCount += 1;
        }
      }
      daily = days;
    }

    const filtered =
      type === 'sale' || type === 'purchase'
        ? rows.filter((row) => row.receipt_type === type)
        : rows;

    const mapped = filtered.map((row) => ({
      ...row,
      vat_15: row.vat_amount ?? row.vat_extracted ?? 0,
      wht_3: row.wht_amount ?? 0,
      receipt_date: row.invoice_date,
      has_evidence: Boolean(row.company_document_path || row.cash_register_receipt_path),
    }));

    return NextResponse.json({
      receipts: mapped,
      summary: {
        ...summary,
        growth: { sales: salesGrowth, purchases: purchaseGrowth },
        daily,
        previousMonth: month ? shiftMonth(month, -1) : null,
      },
      range,
    });
  } catch (err: any) {
    console.error('Receipt list error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to load receipts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const memberships = await getMemberships(ctx);
    const body = await req.json();
    const companyId = (ctx.isPlatformAdmin ? body.company_id : null) || memberships[0]?.company_id || null;
    if (!companyId) {
      return NextResponse.json(
        { error: 'No company associated with this account. Select a company before registering receipts.' },
        { status: 403 }
      );
    }

    const {
      license_id,
      fs_number,
      machine_number,
      receipt_type = 'purchase',
      partner_name,
      partner_tin,
      buyer_tin,
      seller_tin,
      untaxed_amount = 0,
      total_amount,
      company_document_path,
      cash_receipt_path,
      company_document_name,
      cash_register_receipt_name,
      supply_type,
      vat_treatment,
      calendar,
      ocr_engine,
      raw_text,
      confidence_notes,
      lines,
      wht_rate,
    } = body;

    const vatAmount = Number(body.vat_amount ?? body.vat_15 ?? 0) || 0;
    const whtAmount = Number(body.wht_amount ?? body.wht_3 ?? 0) || 0;
    const untaxed = Number(untaxed_amount) || 0;
    const total = Number(total_amount ?? untaxed + vatAmount) || 0;

    if (!fs_number || !partner_name) {
      return NextResponse.json({ error: 'FS number and partner name are required' }, { status: 400 });
    }

    const receiptDate = String(body.date || body.invoice_date || new Date().toISOString().slice(0, 10));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(receiptDate)) {
      return NextResponse.json({ error: 'Receipt date must be YYYY-MM-DD' }, { status: 400 });
    }

    for (const path of [company_document_path, cash_receipt_path]) {
      if (path && !ctx.isPlatformAdmin && !String(path).startsWith(`companies/${companyId}/`)) {
        return NextResponse.json({ error: 'Invalid document path' }, { status: 403 });
      }
    }

    const admin = createAdminSupabase();
    const type = receipt_type === 'sale' ? 'sale' : 'purchase';

    // Duplicate check scoped to this company, with explicit NULL handling.
    let duplicateQuery = admin
      .from('receipt_intakes')
      .select('id, fs_number, machine_number')
      .eq('company_id', companyId)
      .eq('fs_number', fs_number)
      .limit(1);
    duplicateQuery = machine_number
      ? duplicateQuery.eq('machine_number', machine_number)
      : duplicateQuery.is('machine_number', null);
    const { data: duplicateRows } = await duplicateQuery;

    if (duplicateRows && duplicateRows.length > 0) {
      return NextResponse.json(
        {
          error: `Duplicate detected: FS "${fs_number}" from machine "${machine_number || '—'}" is already registered.`,
        },
        { status: 409 }
      );
    }

    const receiptName = `REC/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`;

    const insertPayload: Record<string, any> = {
      company_id: companyId,
      name: receiptName,
      license_id: license_id || 'main',
      fs_number,
      machine_number: machine_number || null,
      receipt_type: type,
      partner_name,
      partner_tin: partner_tin || null,
      buyer_tin: buyer_tin || null,
      seller_tin: seller_tin || null,
      untaxed_amount: untaxed,
      vat_amount: vatAmount,
      wht_amount: whtAmount,
      wht_rate: Number(wht_rate ?? 0) || 0,
      total_amount: total,
      total_extracted: Number(body.extracted_total ?? total_amount ?? 0) || null,
      vat_extracted: Number(body.extracted_vat ?? body.vat_amount ?? 0) || null,
      supply_type: supply_type || 'unknown',
      vat_treatment: vat_treatment || 'standard',
      calendar: calendar || 'gregorian',
      company_document_path: company_document_path || null,
      company_document_name: company_document_name || null,
      cash_register_receipt_path: cash_receipt_path || null,
      cash_register_receipt_name: cash_register_receipt_name || null,
      ocr_engine: ocr_engine || null,
      raw_text: raw_text || null,
      ocr_warnings: Array.isArray(confidence_notes) ? confidence_notes.join('\n') : null,
      invoice_date: receiptDate,
      state: 'registered',
      registered_by: ctx.userId,
      registered_at: new Date().toISOString(),
    };

    const { data: inserted, error: recError } = await admin
      .from('receipt_intakes')
      .insert(insertPayload)
      .select()
      .single();

    let receiptRow: any = inserted;

    if (recError) {
      // Older databases (pre-migration 0004) lack the new evidence/license columns.
      const schemaDrift = recError.code === 'PGRST204' || /column .* does not exist|schema cache/i.test(recError.message || '');
      if (!schemaDrift) {
        return NextResponse.json({ error: recError.message }, { status: 500 });
      }
      for (const key of [
        'license_id',
        'buyer_tin',
        'seller_tin',
        'supply_type',
        'vat_treatment',
        'calendar',
        'company_document_name',
        'cash_register_receipt_name',
        'raw_text',
        'total_extracted',
        'vat_extracted',
      ]) {
        delete insertPayload[key];
      }
      delete insertPayload.ocr_warnings;

      const retry = await admin
        .from('receipt_intakes')
        .insert(insertPayload)
        .select()
        .single();
      if (retry.error) {
        return NextResponse.json(
          { error: `${retry.error.message} — apply supabase/migrations/0004_receipt_evidence_and_ledger.sql to enable evidence and ledger features.` },
          { status: 500 }
        );
      }
      receiptRow = retry.data;
    }

    if (!receiptRow) {
      return NextResponse.json({ error: 'Receipt insert returned no row' }, { status: 500 });
    }

    if (Array.isArray(lines) && lines.length > 0) {
      const lineRows = lines
        .filter((line: any) => line && String(line.description || '').trim())
        .slice(0, 200)
        .map((line: any, index: number) => ({
          company_id: companyId,
          receipt_id: receiptRow.id,
          license_id: insertPayload.license_id,
          line_no: index + 1,
          description: String(line.description).trim(),
          quantity: Number(line.quantity ?? 0) || null,
          unit_price: Number(line.unit_price ?? 0) || null,
          untaxed_amount: Number(line.amount ?? 0) || 0,
          vat_amount: Number(line.vat_amount ?? 0) || 0,
          total_amount: (Number(line.amount ?? 0) || 0) + (Number(line.vat_amount ?? 0) || 0),
        }));
      if (lineRows.length > 0) {
        const { error: linesError } = await admin.from('receipt_lines').insert(lineRows);
        if (linesError) console.error('Receipt lines insert failed:', linesError);
      }
    }

    // Cash movement: the withheld tax is settled separately from the receipt.
    try {
      const cashAmount = Math.max(0, round2(total - whtAmount));
      if (cashAmount > 0) {
        const cashRow = {
          company_id: companyId,
          date: receiptDate,
          transaction_type: type,
          amount: cashAmount,
          signed_amount: type === 'sale' ? cashAmount : -cashAmount,
          description: `${type === 'sale' ? 'Sales Receipt' : 'Vendor Purchase'} - FS: ${fs_number} (${partner_name})`,
          receipt_intake_id: receiptRow.id,
          automatic: true,
          created_by: ctx.userId,
          license_id: insertPayload.license_id,
        };
        const { error: cashError } = await admin.from('balance_transactions').insert(cashRow);
        if (cashError && /license_id/i.test(cashError.message)) {
          delete (cashRow as any).license_id;
          const retry = await admin.from('balance_transactions').insert(cashRow);
          if (retry.error) console.error('Auto balance sync error:', retry.error);
        } else if (cashError) {
          console.error('Auto balance sync error:', cashError);
        }
      }
    } catch (e) {
      console.error('Auto balance sync error:', e);
    }

    let ledgerPosted = false;
    try {
      const posted = await postReceiptToLedger(admin, receiptRow as any, ctx.userId);
      ledgerPosted = posted.posted;
      if (!posted.posted && posted.reason && posted.reason !== 'already-posted' && posted.reason !== 'no-amount') {
        console.warn('Ledger posting skipped:', posted.reason);
      }
    } catch (e) {
      console.error('Ledger posting error:', e);
    }

    return NextResponse.json({ success: true, receipt: receiptRow, ledgerPosted });
  } catch (err: any) {
    console.error('Receipt register error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to register receipt' }, { status: 500 });
  }
}
