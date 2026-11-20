import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { postReceiptToLedger } from '@/lib/ledger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.ctx.supabase;

  try {
    const { data: receipts, error } = await supabase
      .from('receipt_intakes')
      .select(`
        id, company_id, license_id, fs_number, machine_number, receipt_type,
        partner_name, partner_tin, untaxed_amount, vat_amount, wht_amount,
        total_amount, state, invoice_date, created_at,
        company_document_path, cash_register_receipt_path,
        companies ( name )
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const mapped = (receipts || []).map((r: any) => ({
      ...r,
      company_name: r.companies?.name ?? null,
      companies: undefined,
      // Admin UI historically read these aliases.
      vat_15: r.vat_amount ?? 0,
      wht_3: r.wht_amount ?? 0,
      receipt_date: r.invoice_date,
    }));

    return NextResponse.json({ receipts: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.ctx.supabase;

  try {
    const body = await req.json();
    const {
      fs_number,
      machine_number,
      receipt_type,
      partner_name,
      partner_tin,
      company_id,
      license_id,
    } = body;

    if (!fs_number || !partner_name) {
      return NextResponse.json({ error: 'FS number and partner name are required' }, { status: 400 });
    }
    if (!company_id) {
      return NextResponse.json({ error: 'Select the company this receipt belongs to' }, { status: 400 });
    }

    const untaxed = Number(body.untaxed_amount ?? 0) || 0;
    const vat = Number(body.vat_amount ?? body.vat_15 ?? 0) || 0;
    const wht = Number(body.wht_amount ?? body.wht_3 ?? 0) || 0;
    const total = Number(body.total_amount ?? untaxed + vat) || 0;
    const receiptDate = String(body.date || body.invoice_date || new Date().toISOString().slice(0, 10));

    let duplicateQuery = supabase
      .from('receipt_intakes')
      .select('id')
      .eq('company_id', company_id)
      .eq('fs_number', fs_number)
      .limit(1);
    duplicateQuery = machine_number
      ? duplicateQuery.eq('machine_number', machine_number)
      : duplicateQuery.is('machine_number', null);
    const { data: dup } = await duplicateQuery;

    if (dup && dup.length > 0) {
      return NextResponse.json({
        error: `Duplicate: FS Number "${fs_number}" is already registered for this company and machine.`,
      }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('receipt_intakes')
      .insert({
        company_id,
        license_id: license_id || 'main',
        name: `REC/${new Date().getFullYear()}/${Date.now().toString().slice(-6)}`,
        fs_number,
        machine_number: machine_number || null,
        receipt_type: receipt_type === 'sale' ? 'sale' : 'purchase',
        partner_name,
        partner_tin: partner_tin || null,
        untaxed_amount: untaxed,
        vat_amount: vat,
        wht_amount: wht,
        wht_rate: Number(body.wht_rate ?? 0) || 0,
        total_amount: total,
        state: 'registered',
        invoice_date: receiptDate,
        registered_by: auth.ctx.userId,
        registered_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      await postReceiptToLedger(createAdminSupabase(), data as any, auth.ctx.userId);
    } catch (e) {
      console.error('Admin ledger posting error:', e);
    }

    return NextResponse.json({
      receipt: { ...data, vat_15: data.vat_amount, wht_3: data.wht_amount, receipt_date: data.invoice_date },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
