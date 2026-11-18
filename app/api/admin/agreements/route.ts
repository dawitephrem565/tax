import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requirePlatformAdmin(req);
  if (!auth.ok) return auth.response;
  const supabase = auth.ctx.supabase;

  try {
    const body = await req.json();
    const { id, name, body_text, body: altBody, state = 'published' } = body;
    const content = body_text || altBody || '';

    if (!name) return NextResponse.json({ error: 'Template name required' }, { status: 400 });

    if (id && id !== 'default') {
      const { data, error } = await supabase
        .from('agreement_templates')
        .update({
          name,
          body: content,
          state,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ template: data });
    }

    const { data, error } = await supabase
      .from('agreement_templates')
      .insert({
        name,
        body: content,
        state,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
