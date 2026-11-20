import { NextRequest, NextResponse } from 'next/server';
import { authenticate, getMemberships } from '@/lib/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

function mimeFromPath(path: string | null): string | null {
  if (!path) return null;
  const lower = path.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'image/tiff';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const ctx = await authenticate(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;

  const memberships = await getMemberships(ctx);
  const companyId = memberships[0]?.company_id;
  if (!companyId && !ctx.isPlatformAdmin) {
    return NextResponse.json({ error: 'No company associated with this account' }, { status: 403 });
  }

  const admin = createAdminSupabase();
  const { data: receipt, error } = await admin
    .from('receipt_intakes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  if (!ctx.isPlatformAdmin && receipt.company_id !== companyId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: lines } = await admin
    .from('receipt_lines')
    .select('*')
    .eq('receipt_id', id)
    .order('line_no', { ascending: true });

  const { data: entry } = await admin
    .from('journal_entries')
    .select('id, entry_date, reference, description, total_debit, total_credit')
    .eq('source', 'receipt')
    .eq('source_id', id)
    .maybeSingle();

  let journalLines: any[] = [];
  if (entry) {
    const { data } = await admin
      .from('journal_lines')
      .select('id, account_id, description, debit, credit, ledger_accounts (code, name)')
      .eq('entry_id', entry.id);
    journalLines = (data ?? []).map((line: any) => ({
      account: line.ledger_accounts ? `${line.ledger_accounts.code} ${line.ledger_accounts.name}` : 'Unknown',
      description: line.description,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
    }));
  }

  const evidence: Array<{
    kind: 'company_document' | 'pos_receipt';
    name: string | null;
    path: string;
    url: string | null;
    mimeType: string | null;
  }> = [];

  for (const [kind, path, name] of [
    ['company_document', receipt.company_document_path, receipt.company_document_name],
    ['pos_receipt', receipt.cash_register_receipt_path, receipt.cash_register_receipt_name],
  ] as const) {
    if (!path) continue;
    const { data: signed } = await admin.storage.from('documents').createSignedUrl(path, 60 * 10);
    evidence.push({
      kind,
      name: name || path.split('/').pop() || null,
      path,
      url: signed?.signedUrl ?? null,
      mimeType: mimeFromPath(path),
    });
  }

  return NextResponse.json({
    receipt: {
      ...receipt,
      receipt_date: receipt.invoice_date,
      vat_15: receipt.vat_amount ?? 0,
      wht_3: receipt.wht_amount ?? 0,
    },
    lines: lines ?? [],
    evidence,
    journal: entry
      ? {
          id: entry.id,
          date: entry.entry_date,
          reference: entry.reference,
          description: entry.description,
          totalDebit: Number(entry.total_debit || 0),
          totalCredit: Number(entry.total_credit || 0),
          lines: journalLines,
        }
      : null,
  });
}
