import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';

// Deplace UNE personne nommee vers une autre table, separement du reste de
// son groupe -- split_guest_to_new_invitation (migration 0031) la detache
// de son invitation source et cree une nouvelle invitation d'une personne a
// la table choisie. Meme capacite que /api/move-invitation (deplacement au
// niveau du groupe entier) : moveGuests.
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'moveGuests')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { guest_id, table_id } = await req.json().catch(() => ({}));
  if (!guest_id || !table_id) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc('split_guest_to_new_invitation', {
    p_guest_id: guest_id,
    p_table_id: table_id,
    p_agent_id: user.id,
  });

  if (error) {
    const status =
      error.message === 'member_not_found' ||
      error.message === 'invitation_not_found' ||
      error.message === 'table_not_found' ||
      error.message === 'guest_not_found'
        ? 404
        : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ invitation: data });
}
