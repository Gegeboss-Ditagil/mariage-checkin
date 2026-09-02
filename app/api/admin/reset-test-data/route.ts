import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

/**
 * Reinitialise toutes les arrivees (checkins, overflow, exceptions, audit) et
 * remet les invitations a zero. Refuse en mode 'live' pour eviter d'effacer
 * accidentellement les vraies donnees du jour J.
 */
export async function POST() {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'adminPanel')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc('reset_test_event_data', { p_event_id: user.event_id });

  if (error) {
    const status = error.message === 'event_live' ? 409 : error.message === 'event_not_found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
