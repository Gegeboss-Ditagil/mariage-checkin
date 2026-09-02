import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

// Noms libres (ex: "Nourdine, electricien") en plus des comptes existants --
// voir 0043_agenda_custom_assignees.sql. Nettoyage minimal cote serveur :
// texte non vide, coupe a une longueur raisonnable, doublons retires.
function sanitizeCustomAssignees(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const trimmed = entry.trim().slice(0, 120);
    if (trimmed) seen.add(trimmed);
  }
  return Array.from(seen);
}

// Le client (app/agenda/page.tsx) fait `...item.custom_assignees` sans
// verification -- si la migration 0043 n'est pas encore appliquee en prod,
// `select('*')` renvoie simplement des lignes sans cette colonne (Postgrest
// ignore une colonne inexistante au lieu d'echouer), et `undefined` n'est pas
// iterable : la page entiere plantait au premier item, capturee par
// app/error.tsx comme "Mise a jour de l'application" (retour de Gersom le
// 02/09/2026, testee sur le compte de Remy). On garantit ici un tableau,
// meme si la migration n'a pas encore tourne.
function normalizeAgendaItem<T extends { custom_assignees?: unknown }>(item: T): T & { custom_assignees: string[] } {
  return { ...item, custom_assignees: Array.isArray(item.custom_assignees) ? (item.custom_assignees as string[]) : [] };
}

export async function GET() {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'viewAgenda')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const supabase = createAdminClient();
  const [{ data: items, error }, { data: users }] = await Promise.all([
    supabase.from('agenda_items').select('*').eq('event_id', user.event_id).order('sort_order'),
    supabase.from('users').select('id, nom_affichage, nom_complet, role, email').eq('event_id', user.event_id).eq('active', true).order('nom_affichage'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(
    { items: (items || []).map(normalizeAgendaItem), people: users || [], canManage: hasCapability(user.role, 'manageAgenda') },
    { headers: { 'Cache-Control': 'private, no-store' } }
  );
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
    custom_assignees: sanitizeCustomAssignees(body.custom_assignees),
    created_by: user.id,
  }).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: normalizeAgendaItem(data) }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'manageAgenda')) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || '');
  if (!id) return NextResponse.json({ error: 'Activité requise' }, { status: 400 });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ['time_label', 'title', 'department', 'details', 'sort_order', 'assignee_ids', 'custom_assignees', 'completed']) {
    if (key in body) updates[key] = body[key];
  }
  if ('time_label' in updates) updates.time_label = String(updates.time_label || '').trim();
  if ('title' in updates) updates.title = String(updates.title || '').trim();
  if ('department' in updates) updates.department = String(updates.department || 'Coordination').trim();
  if ('details' in updates) updates.details = String(updates.details || '').trim() || null;
  if ('custom_assignees' in updates) updates.custom_assignees = sanitizeCustomAssignees(updates.custom_assignees);
  if (updates.time_label === '' || updates.title === '') return NextResponse.json({ error: 'Heure et activité requises' }, { status: 400 });
  if ('completed' in body) {
    updates.completed_at = body.completed ? new Date().toISOString() : null;
    updates.completed_by = body.completed ? user.id : null;
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('agenda_items').update(updates).eq('id', id).eq('event_id', user.event_id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ item: normalizeAgendaItem(data) });
}
