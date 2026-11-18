import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.ctx.supabase;

  try {
    const { data: files, error } = await supabase
      .from('file_boxes')
      .select(`
        id, company_id, box_category, file_name, file_size,
        storage_path, uploaded_by, created_at,
        companies ( full_name )
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const mapped = (files || []).map((f: any) => ({
      ...f,
      company_name: f.companies?.full_name ?? null,
      companies: undefined,
    }));

    return NextResponse.json({ files: mapped });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
