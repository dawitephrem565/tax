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

    const admin = createAdminSupabase();

    // 1. Fetch published templates
    const { data: templates } = await admin
      .from('agreement_templates')
      .select('*')
      .order('created_at', { ascending: false });

    // 2. Fetch company customized / signed agreements
    let agreements: any[] = [];
    if (companyId) {
      const { data: ags } = await admin
        .from('agreements')
        .select('*')
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });
      agreements = ags || [];
    }

    return NextResponse.json({
      templates: templates || [],
      agreements,
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

    const body = await req.json();
    const { templateId, name, bodyHtml, agreementId } = body;

    if (!name || !bodyHtml) {
      return NextResponse.json({ error: 'Agreement title and body content are required' }, { status: 400 });
    }

    const admin = createAdminSupabase();

    // If agreementId is provided, update existing
    if (agreementId) {
      const { data, error } = await admin
        .from('agreements')
        .update({
          name,
          body: bodyHtml,
          updated_at: new Date().toISOString(),
        })
        .eq('id', agreementId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, agreement: data });
    }

    // Upsert or create for company
    if (templateId && companyId) {
      const { data, error } = await admin
        .from('agreements')
        .upsert(
          {
            company_id: companyId,
            template_id: templateId,
            name,
            body: bodyHtml,
            updated_at: new Date().toISOString(),
            created_by: ctx.userId,
          },
          { onConflict: 'company_id,template_id' }
        )
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, agreement: data });
    }

    // If platform admin updates template directly
    if (ctx.isPlatformAdmin && templateId) {
      const { data, error } = await admin
        .from('agreement_templates')
        .update({
          name,
          body: bodyHtml,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, template: data });
    }

    return NextResponse.json({ error: 'Missing template or company parameters' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
