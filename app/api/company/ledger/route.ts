import { NextRequest, NextResponse } from 'next/server';
import { authenticate, getMemberships } from '@/lib/auth';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { buildLedgerReport, syncReceiptsToLedger } from '@/lib/ledger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SCHEMA_HINT =
  'The accounting tables are missing. Run supabase/migrations/0004_receipt_evidence_and_ledger.sql in the Supabase SQL editor.';

function failureResponse(err: any, fallback: string) {
  const message = String(err?.message || fallback);
  const missingSchema =
    /does not exist|schema cache|Could not load chart of accounts|Could not seed chart/i.test(message);
  if (missingSchema) {
    return NextResponse.json({ error: `${message} — ${SCHEMA_HINT}` }, { status: 503 });
  }
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const memberships = await getMemberships(ctx);
  const params = req.nextUrl.searchParams;
  const companyId =
    (ctx.isPlatformAdmin ? params.get('company_id') : null) || memberships[0]?.company_id || null;
  if (!companyId) {
    return NextResponse.json(
      { error: 'No company associated with this account. Select a company to view its ledger.' },
      { status: 403 }
    );
  }

  const licenseId = params.get('license_id');
  const today = new Date().toISOString().slice(0, 10);
  const from = params.get('from') || `${new Date().getFullYear()}-01-01`;
  const to = params.get('to') || today;

  try {
    const report = await buildLedgerReport(createAdminSupabase(), {
      companyId,
      licenseId,
      from,
      to,
    });
    return NextResponse.json(report);
  } catch (err: any) {
    console.error('Ledger report error:', err);
    return failureResponse(err, 'Failed to build ledger report');
  }
}

export async function POST(req: NextRequest) {
  const ctx = await authenticate(req);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const memberships = await getMemberships(ctx);
  const body = await req.json().catch(() => ({}));
  const companyId =
    (ctx.isPlatformAdmin ? body.company_id : null) || memberships[0]?.company_id || null;
  if (!companyId) {
    return NextResponse.json(
      { error: 'No company associated with this account. Select a company before posting to its ledger.' },
      { status: 403 }
    );
  }

  try {
    const action = body.action || 'sync';
    if (action !== 'sync') {
      return NextResponse.json({ error: `Unknown ledger action "${action}"` }, { status: 400 });
    }

    const result = await syncReceiptsToLedger(createAdminSupabase(), {
      companyId,
      licenseId: body.license_id || null,
      from: body.from || null,
      to: body.to || null,
      userId: ctx.userId,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Ledger sync error:', err);
    return failureResponse(err, 'Failed to post receipts to the ledger');
  }
}
