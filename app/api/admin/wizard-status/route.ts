import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

/**
 * Agrege l'etat d'avancement de la preparation de l'evenement pour piloter
 * l'assistant en 10 etapes (/admin/wizard). Lecture seule, aucune ecriture.
 */
export async function GET() {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const supabase = createAdminClient();
  const eventId = user.event_id;

  const [
    { data: event },
    { data: tables },
    { count: invitationsCount },
    { count: invitationsSansTable },
    { count: qrCount },
    { data: users },
    { data: invitationsPrevu },
  ] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).maybeSingle(),
    supabase.from('tables').select('id, number, capacity, is_reserve').eq('event_id', eventId).order('number'),
    supabase.from('invitations').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase
      .from('invitations')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('table_id', null),
    supabase.from('qr_codes').select('id', { count: 'exact', head: true }).eq('event_id', eventId),
    supabase.from('users').select('id, role, active').eq('event_id', eventId),
    supabase.from('invitations').select('nombre_prevu').eq('event_id', eventId),
  ]);

  const tablesNormales = (tables || []).filter((t) => !t.is_reserve);
  const tablesReserve = (tables || []).filter((t) => t.is_reserve);
  const tablesSansCapacite = (tables || []).filter((t) => !t.capacity || t.capacity <= 0).length;

  const capaciteTotale = (tables || []).reduce((sum, t) => sum + (t.capacity || 0), 0);
  const prevuTotal = (invitationsPrevu || []).reduce((sum, i) => sum + (i.nombre_prevu || 0), 0);

  const agents = (users || []).filter((u) => u.role === 'agent_checkin' && u.active).length;
  const placeurs = (users || []).filter((u) => u.role === 'placeur' && u.active).length;
  const admins = (users || []).filter((u) => u.role === 'admin' && u.active).length;

  const qrManquants = Math.max((tables || []).length - (qrCount || 0), 0);

  return NextResponse.json({
    event,
    stats: {
      tablesTotal: (tables || []).length,
      tablesNormales: tablesNormales.length,
      tablesReserve: tablesReserve.length,
      tablesSansCapacite,
      capaciteTotale,
      invitationsTotal: invitationsCount || 0,
      invitationsSansTable: invitationsSansTable || 0,
      prevuTotal,
      qrTotal: qrCount || 0,
      qrManquants,
      agents,
      placeurs,
      admins,
    },
  });
}
