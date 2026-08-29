import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

const VALID_STATUSES = ['attendu', 'arrive', 'ne_viendra_pas'];

/** Bascule l'etat d'arrivee d'UNE personne du groupe (voir GuestArrivalPanel).
 * Meme droits d'acces que /api/checkin : c'est une action de check-in, pas de
 * gestion de la liste (contrairement a /api/members/add|remove|rename qui
 * exigent 'manageMembers'). */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'checkin')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { guest_id, status } = await req.json().catch(() => ({}));
  if (!guest_id || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('set_guest_arrival_status', {
    p_guest_id: guest_id,
    p_agent_id: user.id,
    p_status: status,
  });

  if (error) {
    const httpStatus =
      error.message === 'guest_not_found' || error.message === 'invitation_not_found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status: httpStatus });
  }

  return NextResponse.json({ invitation: data });
}
