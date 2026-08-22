import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

/**
 * Variante en lot de /api/move-invitation : deplace plusieurs invitations
 * vers UNE meme table cible en un seul appel (selection multiple sur
 * /tables/[tableId], voir move_invitations_table dans
 * 0020_bulk_move_and_swap_invitations.sql).
 */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'directeur', 'placeur'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { invitation_ids, new_table_id } = await req.json().catch(() => ({}));
  if (!Array.isArray(invitation_ids) || invitation_ids.length === 0 || !new_table_id) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('move_invitations_table', {
    p_invitation_ids: invitation_ids,
    p_new_table_id: new_table_id,
    p_agent_id: user.id,
  });

  if (error) {
    const status = error.message === 'table_not_found' ? 404 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ invitations: data, moved: (data || []).length });
}
