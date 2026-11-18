import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.ctx.supabase;

  try {
    const { data: runs, error } = await supabase
      .from('payroll_runs')
      .select(`
        id, company_id, period_month, period_year,
        total_employees, total_gross, total_pension_emp, total_pension_org,
        total_income_tax, total_net, state, created_at,
        companies ( full_name )
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const mapped = (runs || []).map((r: any) => ({
      ...r,
      company_name: r.companies?.full_name ?? null,
      companies: undefined,
    }));

    return NextResponse.json({ runs: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
