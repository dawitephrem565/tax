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

    const licenseId = req.nextUrl.searchParams.get('license_id');

    const admin = createAdminSupabase();

    let runsQuery = admin
      .from('payroll_runs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!ctx.isPlatformAdmin && companyId) {
      runsQuery = runsQuery.eq('company_id', companyId);
    }

    if (licenseId && licenseId !== 'all') {
      try {
        runsQuery = runsQuery.eq('license_id', licenseId);
      } catch {
        // column may not exist yet
      }
    }

    let { data: runs, error: runsErr } = await runsQuery.limit(20);
    if (runsErr && runsErr.message?.includes('license_id')) {
      let fallbackQuery = admin
        .from('payroll_runs')
        .select('*')
        .order('created_at', { ascending: false });
      if (!ctx.isPlatformAdmin && companyId) {
        fallbackQuery = fallbackQuery.eq('company_id', companyId);
      }
      const retry = await fallbackQuery.limit(20);
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
      runs = (retry.data || []).filter((r: any) => {
        if (r.license_id) return r.license_id === licenseId;
        if (r.name?.includes(`[Lic: ${licenseId}]`)) return true;
        if (licenseId === 'main' && !r.name?.includes('[Lic: ')) return true;
        return false;
      });
      runsErr = null;
    } else if (runsErr) {
      return NextResponse.json({ error: runsErr.message }, { status: 500 });
    }

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
      license_id,
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

    const runPayload: Record<string, any> = {
      company_id: companyId,
      name: `Payroll ${month}/${year} - ${employees.length} Staff${license_id ? ` [Lic: ${license_id}]` : ''}`,
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
    };

    if (license_id && license_id !== 'main') {
      runPayload.license_id = license_id;
    }

    let run: any = null;
    const { data: insertedRun, error: runError } = await admin
      .from('payroll_runs')
      .insert(runPayload)
      .select()
      .single();

    if (runError) {
      if (runPayload.license_id) {
        delete runPayload.license_id;
        const retry = await admin.from('payroll_runs').insert(runPayload).select().single();
        if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
        run = retry.data;
      } else {
        return NextResponse.json({ error: runError.message }, { status: 500 });
      }
    } else {
      run = insertedRun;
    }

    // 2. Insert individual payslips
    const slipRows = employees.map((emp) => {
      const row: Record<string, any> = {
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
      };
      if (license_id && license_id !== 'main') {
        row.license_id = license_id;
      }
      return row;
    });

    const slipsResult = await admin.from('payslips').insert(slipRows);
    if (slipsResult.error && slipRows[0]?.license_id) {
      // Retry without license_id if column does not exist
      slipRows.forEach((r) => delete r.license_id);
      await admin.from('payslips').insert(slipRows);
    }

    // 3. Deduct total payroll payout from Bank Balance
    const totalPayrollOutflow = Math.round((totalNet + totalIncomeTax + totalPensionEmp + totalPensionOrg) * 100) / 100;

    try {
      await admin.from('balance_transactions').insert({
        company_id: companyId,
        date: new Date().toISOString().split('T')[0],
        transaction_type: 'payroll',
        amount: totalPayrollOutflow,
        signed_amount: -totalPayrollOutflow,
        description: `Payroll Month ${month}/${year} (${employees.length} Staff)${license_id ? ` [Lic: ${license_id}]` : ''}`,
        automatic: true,
        created_by: ctx.userId,
      });
    } catch {}

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
