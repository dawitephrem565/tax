import { NextRequest, NextResponse } from 'next/server';
import { authenticate, getMemberships } from '@/lib/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const memberships = await getMemberships(ctx);
    const companyId = memberships[0]?.company_id;
    if (!companyId && !ctx.isPlatformAdmin) {
      return NextResponse.json({ error: 'No company associated with this account' }, { status: 403 });
    }

    const admin = createAdminSupabase();
    let query = admin.from('receipt_intakes').select('*').order('created_at', { ascending: false });
    if (!ctx.isPlatformAdmin && companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const mapped = (data || []).map((r: any) => ({
      ...r,
      vat_15: r.vat_amount || r.vat_15 || 0,
      wht_3: r.wht_amount || r.wht_3 || 0,
      receipt_date: r.invoice_date || r.receipt_date || r.created_at,
    }));

    return NextResponse.json({ receipts: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const memberships = await getMemberships(ctx);
    const companyId = memberships[0]?.company_id;
    if (!companyId && !ctx.isPlatformAdmin) {
      return NextResponse.json({ error: 'No company associated with this account' }, { status: 403 });
    }

    const body = await req.json();
    const {
      fs_number,
      machine_number,
      receipt_type = 'purchase',
      partner_name,
      partner_tin,
      untaxed_amount = 0,
      vat_15 = 0,
      wht_3 = 0,
      total_amount = 0,
      company_document_path,
      cash_receipt_path,
      date,
    } = body;

    if (!fs_number || !partner_name) {
      return NextResponse.json({ error: 'FS number and partner name are required' }, { status: 400 });
    }

    const admin = createAdminSupabase();

    // Check duplicate FS + Machine
    const { data: duplicate } = await admin
      .from('receipt_intakes')
      .select('id, fs_number, machine_number')
      .eq('fs_number', fs_number)
      .eq('machine_number', machine_number || '')
      .maybeSingle();

    if (duplicate) {
      return NextResponse.json(
        { error: `Duplicate detected: Receipt with FS Number "${fs_number}" and Machine "${machine_number}" is already registered.` },
        { status: 409 }
      );
    }

    const receiptDate = date || new Date().toISOString().split('T')[0];
    const receiptName = `REC/${new Date().getFullYear()}/${Date.now().toString().slice(-4)}`;

    // Insert Receipt matching 0000_full_schema.sql
    const { data: newReceipt, error: recError } = await admin
      .from('receipt_intakes')
      .insert({
        company_id: companyId,
        name: receiptName,
        fs_number,
        machine_number: machine_number || null,
        receipt_type: receipt_type === 'sale' ? 'sale' : 'purchase',
        partner_name,
        partner_tin: partner_tin || null,
        untaxed_amount: Number(untaxed_amount),
        vat_amount: Number(vat_15),
        wht_amount: Number(wht_3),
        total_amount: Number(total_amount),
        company_document_path: company_document_path || null,
        cash_register_receipt_path: cash_receipt_path || null,
        invoice_date: receiptDate,
        state: 'posted',
      })
      .select()
      .single();

    if (recError) return NextResponse.json({ error: recError.message }, { status: 500 });

    // Automatically synchronize treasury balance transaction
    try {
      const isSale = receipt_type === 'sale';
      const signedAmount = isSale ? Number(total_amount) : -Number(total_amount);

      await admin.from('balance_transactions').insert({
        company_id: companyId,
        date: receiptDate,
        transaction_type: isSale ? 'sale' : 'purchase',
        amount: Math.abs(Number(total_amount)),
        signed_amount: signedAmount,
        description: `${isSale ? 'Sales Receipt' : 'Vendor Purchase'} - FS: ${fs_number} (${partner_name})`,
        receipt_intake_id: newReceipt.id,
        automatic: true,
        created_by: ctx.userId,
      });
    } catch (e) {
      console.error('Auto balance sync error:', e);
    }

    return NextResponse.json({ success: true, receipt: newReceipt });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
