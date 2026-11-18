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
    let query = admin
      .from('balance_transactions')
      .select('*')
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!ctx.isPlatformAdmin && companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data: transactions, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = transactions || [];
    let openingDeposit = 0;
    let totalInflow = 0;
    let totalOutflow = 0;

    for (const tx of list) {
      const signed = Number(tx.signed_amount || 0);
      const amount = Number(tx.amount || 0);
      if (tx.transaction_type === 'opening') {
        openingDeposit += amount;
      }
      if (signed > 0) {
        totalInflow += signed;
      } else if (signed < 0) {
        totalOutflow += Math.abs(signed);
      }
    }

    // Available balance is Inflows minus Outflows
    const availableBalance = Math.round((totalInflow - totalOutflow) * 100) / 100;
    const warningThreshold = Math.round(openingDeposit * 0.3 * 100) / 100; // 30% rule from Odoo
    const isBelowThreshold = openingDeposit > 0 && availableBalance < warningThreshold;
    const dropPercent = openingDeposit > 0 ? Math.round(((openingDeposit - availableBalance) / openingDeposit) * 100) : 0;

    return NextResponse.json({
      summary: {
        availableBalance,
        openingDeposit,
        totalInflow: Math.round(totalInflow * 100) / 100,
        totalOutflow: Math.round(totalOutflow * 100) / 100,
        warningThreshold,
        isBelowThreshold,
        dropPercent: Math.max(0, dropPercent),
      },
      transactions: list,
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
    const { action, amount, description } = body;
    const numAmount = Math.abs(Number(amount));

    if (!numAmount || numAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be a positive number' }, { status: 400 });
    }

    const admin = createAdminSupabase();

    if (action === 'set_opening') {
      // Remove previous opening balance to replace or set
      await admin
        .from('balance_transactions')
        .delete()
        .eq('company_id', companyId)
        .eq('transaction_type', 'opening');

      const { data, error } = await admin.from('balance_transactions').insert({
        company_id: companyId,
        date: new Date().toISOString().split('T')[0],
        transaction_type: 'opening',
        amount: numAmount,
        signed_amount: numAmount,
        description: description || 'Initial Company Opening Bank Balance',
        automatic: false,
        created_by: ctx.userId,
      }).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, transaction: data });
    }

    if (action === 'deposit' || action === 'withdrawal') {
      const isDeposit = action === 'deposit';
      const signed = isDeposit ? numAmount : -numAmount;

      const { data, error } = await admin.from('balance_transactions').insert({
        company_id: companyId,
        date: new Date().toISOString().split('T')[0],
        transaction_type: isDeposit ? 'deposit' : 'withdrawal',
        amount: numAmount,
        signed_amount: signed,
        description: description || (isDeposit ? 'Bank Deposit' : 'Bank Withdrawal'),
        automatic: false,
        created_by: ctx.userId,
      }).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, transaction: data });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
