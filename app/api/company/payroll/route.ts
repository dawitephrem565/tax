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

    let runsQuery = admin
      .from('payroll_runs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!ctx.isPlatformAdmin && companyId) {
      runsQuery = runsQuery.eq('company_id', companyId);
    }

    const { data: runs, error: runsErr } = await runsQuery.limit(10);
    if (runsErr) return NextResponse.json({ error: runsErr.message }, { status: 500 });

    const latestRun = runs && runs.length > 0 ? runs[0] : null;

    let payslips: any[] = [];
    if (latestRun) {
      const { data: slipData } = await admin
        .from('payslips')
        .select('*')
        .eq('payroll_run_id', latestRun.id);
      payslips = slipData || [];
    }

    return NextResponse.json({
      latestRun,
      lastCalculatedAt: latestRun?.created_at || null,
      history: runs || [],
      payslips,
    });
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
      month = new Date().getMonth() + 1,
      year = new Date().getFullYear(),
      employees = [],
    } = body;

    if (!Array.isArray(employees) || employees.length === 0) {
      return NextResponse.json({ error: 'At least one employee is required for payroll calculation.' }, { status: 400 });
    }

    const admin = createAdminSupabase();

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

    // 1. Insert into payroll_runs (matching 0000_full_schema.sql columns)
    const { data: run, error: runError } = await admin
      .from('payroll_runs')
      .insert({
        company_id: companyId,
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
        created_by: ctx.userId,
      })
      .select()
      .single();

    if (runError) return NextResponse.json({ error: runError.message }, { status: 500 });

    // 2. Insert individual payslips
    const slipRows = employees.map((emp) => ({
      payroll_run_id: run.id,
      company_id: companyId,
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

    // 3. Deduct total payroll payout from Bank Balance (Odoo treasury port)
    const totalPayrollOutflow = Math.round((totalNet + totalIncomeTax + totalPensionEmp + totalPensionOrg) * 100) / 100;

    await admin.from('balance_transactions').insert({
      company_id: companyId,
      date: new Date().toISOString().split('T')[0],
      transaction_type: 'payroll',
      amount: totalPayrollOutflow,
      signed_amount: -totalPayrollOutflow,
      description: `Payroll Deduction: Month ${month}/${year} (${employees.length} Staff)`,
      automatic: true,
      created_by: ctx.userId,
    });

    return NextResponse.json({
      success: true,
      run,
      lastCalculatedAt: run.created_at,
      totalDeducted: totalPayrollOutflow,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
