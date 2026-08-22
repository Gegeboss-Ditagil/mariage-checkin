import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

/**
 * Ajoute une etiquette a une invitation (ex: 'Photographe', 'SERVICES',
 * 'Côté_Gege', 'notable'). Meme perimetre de roles que rename_invitation
 * (manageMembers) -- effet de bord automatique sur `category`/`cote` gere
 * cote SQL (add_invitation_tag, 0022_manage_invitation_tags.sql).
 */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'directeur', 'placeur', 'agent_checkin'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { invitation_id, tag } = await req.json().catch(() => ({}));
  if (!invitation_id || !tag || typeof tag !== 'string' || !tag.trim()) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('add_invitation_tag', {
    p_invitation_id: invitation_id,
    p_tag: tag,
    p_agent_id: user.id,
  });

  if (error) {
    const status = error.message === 'invitation_not_found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ invitation: data });
}
