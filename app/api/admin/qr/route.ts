import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

export async function GET() {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const supabase = createAdminClient();
  const [{ data: qrCodes }, { data: tables }] = await Promise.all([
    supabase.from('qr_codes').select('*').eq('event_id', user.event_id),
    supabase.from('tables').select('id, number, label').eq('event_id', user.event_id).order('number'),
  ]);

  return NextResponse.json({ qrCodes: qrCodes || [], tables: tables || [] });
}

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { code, table_id } = await req.json().catch(() => ({}));
  if (!code || !table_id) return NextResponse.json({ error: 'code et table_id requis' }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('qr_codes')
    .upsert({ event_id: user.event_id, code, table_id }, { onConflict: 'event_id,code' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ qrCode: data });
}

export async function DELETE(req: NextRequest) {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('qr_codes').delete().eq('id', id).eq('event_id', user.event_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
