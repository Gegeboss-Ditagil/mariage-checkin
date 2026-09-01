import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'viewAgenda')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const supabase = createAdminClient();
  const [{ data: items, error }, { data: users }] = await Promise.all([
    supabase.from('agenda_items').select('*').eq('event_id', user.event_id).order('sort_order'),
    supabase.from('users').select('id, nom_affichage, nom_complet, role, email').eq('event_id', user.event_id).eq('active', true).order('nom_affichage'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ items: items || [], people: users || [], canManage: hasCapability(user.role, 'manageAgenda') }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'manageAgenda')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || '').trim();
  const timeLabel = String(body.time_label || '').trim();
  if (!title || !timeLabel) return NextResponse.json({ error: 'Heure et activité requises' }, { status: 400 });
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('agenda_items').insert({
    event_id: user.event_id,
    time_label: timeLabel,
    title,
    department: String(body.department || 'Coordination').trim(),
    details: String(body.details || '').trim() || null,
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : Date.now(),
    assignee_ids: Array.isArray(body.assignee_ids) ? body.assignee_ids : [],
    created_by: user.id,
  }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'manageAgenda')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'Activité requise' }, { status: 400 });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ['time_label', 'title', 'department', 'details', 'sort_order', 'assignee_ids', 'completed']) {
    if (key in body) updates[key] = body[key];
  }
  if ('completed' in body) {
    updates.completed_at = body.completed ? new Date().toISOString() : null;
    updates.completed_by = body.completed ? user.id : null;
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('agenda_items').update(updates).eq('id', id).eq('event_id', user.event_id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: data });
}
