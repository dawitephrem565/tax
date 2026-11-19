import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  const admin = createAdminSupabase();

  try {
    let runsQuery = admin
      .from('payroll_runs')
      .select(`
        id, company_id, period_month, period_year,
        total_employees, total_gross, total_pension_emp, total_pension_org,
        total_income_tax, total_net, state, created_at,
        companies ( name )
      `)
      .order('created_at', { ascending: false });

    if (companyId) {
      runsQuery = runsQuery.eq('company_id', companyId);
    }

    const { data: runs, error } = await runsQuery.limit(100);

    if (error) {
      console.error('Admin payroll GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const mapped = (runs || []).map((r: any) => ({
      ...r,
      company_name: r.companies?.name ?? null,
      companies: undefined,
    }));

    let payslips: any[] = [];
    if (companyId && mapped.length > 0) {
      const { data: slips } = await admin
        .from('payslips')
        .select('*')
        .eq('payroll_run_id', mapped[0].id);
      payslips = slips || [];
    }

    return NextResponse.json({
      runs: mapped,
      payslips,
      latestRun: mapped.length > 0 ? mapped[0] : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;

  const admin = createAdminSupabase();

  try {
    const body = await req.json();
    const {
      company_id,
      month = new Date().getMonth() + 1,
      year = new Date().getFullYear(),
      employees = [],
    } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'Company selection is required for payroll' }, { status: 400 });
    }

    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ error: 'At least one employee is required for payroll calculation.' }, { status: 400 });
    }

    let totalBasic = 0;
    let totalGross = 0;
    let totalTaxable = 0;
    let totalIncomeTax = 0;
    let totalPensionEmp = 0;
    let totalPensionOrg = 0;
    let totalNet = 0;

    for (const emp of employees) {
      totalBasic += Number(emp.basic || 0);
      totalGross += Number(emp.gross || emp.basic || 0);
      totalTaxable += Number(emp.taxableIncome || emp.basic || 0);
      totalIncomeTax += Number(emp.tax || 0);
      totalPensionEmp += Number(emp.pensionEmp || 0);
      totalPensionOrg += Number(emp.pensionOrg || 0);
      totalNet += Number(emp.net || 0);
    }

    const dateFrom = new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toISOString().split('T')[0];
    const dateTo = new Date(Date.UTC(Number(year), Number(month), 0)).toISOString().split('T')[0];

    const { data: run, error: runError } = await admin
      .from('payroll_runs')
      .insert({
        company_id,
        name: `Payroll ${month}/${year} - ${employees.length} Staff`,
        date_from: dateFrom,
        date_to: dateTo,
        status: 'confirmed',
        total_basic: Math.round(totalBasic * 100) / 100,
        total_gross: Math.round(totalGross * 100) / 100,
        total_taxable: Math.round(totalTaxable * 100) / 100,
        total_income_tax: Math.round(totalIncomeTax * 100) / 100,
        total_pension_employee: Math.round(totalPensionEmp * 100) / 100,
        total_pension_employer: Math.round(totalPensionOrg * 100) / 100,
        total_net_pay: Math.round(totalNet * 100) / 100,
        created_by: auth.ctx.userId,
      })
      .select()
      .single();

    if (runError) {
      console.error('Admin create payroll run error:', runError);
      return NextResponse.json({ error: runError.message }, { status: 500 });
    }

    const slipRows = employees.map((emp) => ({
      payroll_run_id: run.id,
      company_id,
      employee_name: emp.name,
      tin: emp.tin || null,
      basic_salary: Number(emp.basic || 0),
      transport_allowance: Number(emp.transport || 0),
      taxable_income: Number(emp.taxableIncome || emp.basic || 0),
      income_tax: Number(emp.tax || 0),
      pension_employee: Number(emp.pensionEmp || 0),
      pension_employer: Number(emp.pensionOrg || 0),
      net_pay: Number(emp.net || 0),
      status: 'confirmed',
    }));

    await admin.from('payslips').insert(slipRows);

    return NextResponse.json({
      success: true,
      run,
      lastCalculatedAt: run.created_at,
    });
  } catch (err: any) {
    console.error('Admin payroll POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
