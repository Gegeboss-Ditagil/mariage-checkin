import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';

/**
 * Echange entre deux tables : un groupe d'invitations quitte la table A pour
 * la table B, un autre groupe quitte B pour A, dans la meme transaction. Les
 * deux groupes n'ont pas besoin d'avoir la meme taille (ex: 2 personnes
 * contre 4) -- voir swap_invitations_between_tables dans
 * 0020_bulk_move_and_swap_invitations.sql.
 */
export async function POST(req: NextRequest) {
  const user = getSessionUser();
  if (!user || !['admin', 'directeur', 'placeur'].includes(user.role)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { ids_out_of_a, table_a, ids_out_of_b, table_b } = await req.json().catch(() => ({}));
  const aValid = Array.isArray(ids_out_of_a) && ids_out_of_a.length > 0;
  const bValid = Array.isArray(ids_out_of_b) && ids_out_of_b.length > 0;
  if (!aValid || !bValid || !table_a || !table_b) {
    return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.rpc('swap_invitations_between_tables', {
    p_ids_out_of_a: ids_out_of_a,
    p_table_a: table_a,
    p_ids_out_of_b: ids_out_of_b,
    p_table_b: table_b,
    p_agent_id: user.id,
  });

  if (error) {
    const status = error.message === 'same_table' ? 409 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ ok: true });
}
