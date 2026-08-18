import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

/**
 * Reinitialise toutes les arrivees (checkins, overflow, exceptions, audit) et
 * remet les invitations a zero. Refuse en mode 'live' pour eviter d'effacer
 * accidentellement les vraies donnees du jour J.
 */
export async function POST() {
  const user = getSessionUser();
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });

  const supabase = createAdminClient();

  const { data: event } = await supabase.from('events').select('status').eq('id', user.event_id).maybeSingle();
  if (event?.status === 'live') {
    return NextResponse.json(
      { error: "Impossible de réinitialiser en mode LIVE. Passez d'abord en mode test." },
      { status: 409 }
    );
  }

  await supabase.from('checkins').delete().eq('event_id', user.event_id);
  await supabase.from('overflow_assignments').delete().eq('event_id', user.event_id);
  await supabase.from('exceptions').delete().eq('event_id', user.event_id);
  await supabase.from('audit_logs').delete().eq('event_id', user.event_id);
  await supabase
    .from('invitations')
    .update({ nombre_arrive: 0, nombre_supplementaire: 0, statut: 'non_arrive' })
    .eq('event_id', user.event_id);

  return NextResponse.json({ ok: true });
}
