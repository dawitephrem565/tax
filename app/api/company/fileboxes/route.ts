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

    const { data: files, error } = await query;
    if (error) {
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
      name,
      category,
      storage_path,
      filename,
      mimetype,
      file_size,
      notes,
    } = body;

    if (!name || !category || !storage_path || !filename) {
      return NextResponse.json(
        { error: 'name, category, storage_path, and filename are required' },
        { status: 400 }
      );
    }

    const admin = createAdminSupabase();
    const { data, error } = await admin
      .from('file_boxes')
      .insert({
        company_id: companyId,
        name,
        category,
        storage_path,
        filename,
        mimetype: mimetype || 'application/octet-stream',
        file_size: file_size || 0,
        notes: notes || null,
        uploaded_by: ctx.userId,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, file: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
