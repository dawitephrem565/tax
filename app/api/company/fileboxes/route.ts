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

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category');
    const licenseId = searchParams.get('license_id');

    const admin = createAdminSupabase();
    let query = admin
      .from('file_boxes')
      .select('*')
      .order('created_at', { ascending: false });

    if (!ctx.isPlatformAdmin && companyId) {
      query = query.eq('company_id', companyId);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (licenseId && licenseId !== 'all') {
      try {
        query = query.eq('license_id', licenseId);
      } catch {
        // column may not exist yet
      }
    }

    let { data: files, error } = await query;
    if (error && error.message?.includes('license_id')) {
      let fallbackQuery = admin
        .from('file_boxes')
        .select('*')
        .order('created_at', { ascending: false });
      if (!ctx.isPlatformAdmin && companyId) fallbackQuery = fallbackQuery.eq('company_id', companyId);
      if (category) fallbackQuery = fallbackQuery.eq('category', category);
      const retry = await fallbackQuery;
      if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
      files = (retry.data || []).filter((f: any) => {
        if (f.license_id) return f.license_id === licenseId;
        if (f.notes?.includes(`[Lic: ${licenseId}]`)) return true;
        if (licenseId === 'main' && !f.notes?.includes('[Lic: ')) return true;
        return false;
      });
      error = null;
    } else if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Compute category counts
    const counts: Record<string, number> = {
      petty_cash: 0,
      income_tax_pension: 0,
      purchase_receipt: 0,
      sales_receipt: 0,
      agreement: 0,
      z_report: 0,
    };

    (files || []).forEach((f: any) => {
      if (counts[f.category] !== undefined) {
        counts[f.category]++;
      }
    });

    return NextResponse.json({
      success: true,
      files: files || [],
      counts,
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
      name,
      category,
      storage_path,
      filename,
      mimetype = 'application/octet-stream',
      file_size = 0,
      notes,
    } = body;

    if (!name || !category || !storage_path) {
      return NextResponse.json({ error: 'Name, category and storage path are required' }, { status: 400 });
    }

    const admin = createAdminSupabase();

    const insertPayload: Record<string, any> = {
      company_id: companyId,
      name,
      category,
      storage_path,
      filename: filename || name,
      mimetype,
      file_size,
      notes: license_id && license_id !== 'main' ? (notes ? `${notes} [Lic: ${license_id}]` : `[Lic: ${license_id}]`) : (notes || null),
      created_by: ctx.userId,
    };

    if (license_id && license_id !== 'main') {
      insertPayload.license_id = license_id;
    }

    let fileRecord: any = null;
    const { data, error } = await admin
      .from('file_boxes')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      if (insertPayload.license_id) {
        delete insertPayload.license_id;
        const retry = await admin.from('file_boxes').insert(insertPayload).select().single();
        if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
        fileRecord = retry.data;
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      fileRecord = data;
    }

    return NextResponse.json({ success: true, file: fileRecord }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
