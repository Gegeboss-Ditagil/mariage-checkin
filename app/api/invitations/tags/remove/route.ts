import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

/**
 * Retire une etiquette d'une invitation. Capacite dediee `manageTags`
 * (admin, directeur, placeur -- PAS agent scan, retire le 23/08/2026 sur
 * demande explicite de Gersom) -- effet de bord automatique sur
 * `category`/`cote` gere cote SQL (remove_invitation_tag,
 * 0022_manage_invitation_tags.sql) : ne repasse category a null que si
 * c'etait le dernier tag de role restant.
 */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'manageTags')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { invitation_id, tag } = await req.json().catch(() => ({}));
  if (!invitation_id || !tag || typeof tag !== 'string' || !tag.trim()) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('remove_invitation_tag', {
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
