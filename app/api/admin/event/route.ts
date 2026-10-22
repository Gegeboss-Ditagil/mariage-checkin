import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const supabase = createAdminClient();
  const { data, error } = await supabase.from('events').select('*').eq('id', user.event_id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ event: data, viewerRole: user.role });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !hasCapability(user.role, 'manageEventMode')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { status, name, event_date, reserve_table_capacity, twilio_enabled } = body;

  // v1.85.0 : le directeur ne change que le mode (statut) ; nom, date,
  // capacité de réserve et Twilio restent réservés à l'admin (adminPanel).
  const onlyStatus = Object.keys(body).every((key) => key === 'status');
  if (!onlyStatus && !hasCapability(user.role, 'adminPanel')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (status !== undefined) {
    if (!['setup', 'test', 'live', 'closed'].includes(status)) {
      return NextResponse.json({ error: 'status invalide' }, { status: 400 });
    }
    patch.status = status;
  }
  if (name !== undefined) {
    if (!String(name).trim()) return NextResponse.json({ error: "nom de l'événement requis" }, { status: 400 });
    patch.name = String(name).trim();
  }
  if (event_date !== undefined) patch.event_date = event_date || null;
  if (reserve_table_capacity !== undefined) {
    const cap = Number(reserve_table_capacity);
    if (!Number.isFinite(cap) || cap <= 0) {
      return NextResponse.json({ error: 'capacité de réserve invalide' }, { status: 400 });
    }
    patch.reserve_table_capacity = cap;
  }
  if (twilio_enabled !== undefined) {
    patch.twilio_enabled = Boolean(twilio_enabled);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'aucune modification fournie' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('events')
    .update(patch)
    .eq('id', user.event_id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ event: data });
}
