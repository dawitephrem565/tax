import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.ctx.supabase;

  try {
    const { data: receipts, error } = await supabase
      .from('receipt_intakes')
      .select(`
        id, company_id, fs_number, machine_number, receipt_type,
        partner_name, partner_tin, untaxed_amount, vat_15, wht_3,
        total_amount, state, receipt_date, created_at,
        companies ( full_name )
      `)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const mapped = (receipts || []).map((r: any) => ({
      ...r,
      company_name: r.companies?.full_name ?? null,
      companies: undefined,
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
    const { fs_number, machine_number, receipt_type, partner_name,
            partner_tin, untaxed_amount, vat_15, wht_3, total_amount, company_id } = body;

    if (!fs_number || !partner_name) {
      return NextResponse.json({ error: 'FS number and partner name are required' }, { status: 400 });
    }

    // Duplicate FS + Machine check
    const { data: dup } = await supabase
      .from('receipt_intakes')
      .select('id')
      .eq('fs_number', fs_number)
      .eq('machine_number', machine_number || '')
      .maybeSingle();

    if (dup) {
      return NextResponse.json({
        error: `Duplicate: FS Number "${fs_number}" already registered for this machine.`
      }, { status: 409 });
    }

    const { data, error } = await supabase
      .from('receipt_intakes')
      .insert({
        company_id: company_id || null,
        fs_number,
        machine_number: machine_number || null,
        receipt_type: receipt_type || 'purchase',
        partner_name,
        partner_tin: partner_tin || null,
        untaxed_amount: untaxed_amount || 0,
        vat_15: vat_15 || 0,
        wht_3: wht_3 || 0,
        total_amount: total_amount || 0,
        state: 'registered',
        receipt_date: new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ receipt: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
