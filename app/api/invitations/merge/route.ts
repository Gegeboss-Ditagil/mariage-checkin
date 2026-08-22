import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

/**
 * Fusionne une invitation source dans une invitation cible (ex: regrouper
 * un accompagnant isole avec son vrai groupe). Memes roles que le
 * deplacement de table (moveGuests) : c'est une reorganisation structurelle,
 * pas une simple correction de nom.
 */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'directeur', 'placeur'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { source_invitation_id, target_invitation_id } = await req.json().catch(() => ({}));
  if (!source_invitation_id || !target_invitation_id) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('merge_invitations', {
    p_source_invitation_id: source_invitation_id,
    p_target_invitation_id: target_invitation_id,
    p_agent_id: user.id,
  });

  if (error) {
    const status =
      error.message === 'source_not_found' || error.message === 'target_not_found'
        ? 404
        : error.message === 'same_invitation'
        ? 409
        : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ invitation: data });
}
