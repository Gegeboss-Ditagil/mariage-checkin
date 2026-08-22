import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

/**
 * Renomme le nom affiche d'une invitation (pas un membre detaille -- voir
 * /api/members/rename pour ca). Meme perimetre de roles que la gestion des
 * membres (manageMembers) : c'est une correction de nom, pas un deplacement
 * structurel.
 */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'directeur', 'placeur', 'agent_checkin'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { invitation_id, nouveau_nom } = await req.json().catch(() => ({}));
  if (!invitation_id || !nouveau_nom || typeof nouveau_nom !== 'string' || !nouveau_nom.trim()) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('rename_invitation', {
    p_invitation_id: invitation_id,
    p_nouveau_nom: nouveau_nom,
    p_agent_id: user.id,
  });

  if (error) {
    const status = error.message === 'invitation_not_found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ invitation: data });
}
