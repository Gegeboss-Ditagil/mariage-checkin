import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { applyGuestApprovalDecision } from '@/lib/guestApprovalDecide';

/**
 * Reconsidère une demande REFUSÉE en la plaçant d'abord, puis en
 * l'approuvant -- demande de Gersom le 13/09/2026 : "si je reconsidère
 * quelqu'un et je fais approuver, je n'avais pas l'option de le mettre sur
 * une table... le process a été automatique". Avant v1.44.0, "Reconsidérer
 * -> Approuver" appelait directement /decide, qui laissait le placement
 * automatique (auto_assign_table_for_guest_approval, 0045) choisir la
 * table -- désormais l'agent choisit d'abord sur /approbations/[id]/assign
 * (mode "reconsider"), et cette route enchaîne les deux étapes :
 *
 * 1. Réserve la table choisie (reserve_table_for_guest_approval, étendue en
 *    0050 pour accepter un statut 'refuse', pas seulement 'en_attente') --
 *    mêmes vérifications de capacité que la réservation avant-décision.
 * 2. Approuve la demande (allowReconsiderFromRefused) : `finalizeDecision`
 *    (lib/guestApprovalDecide.ts) détecte la réservation qu'on vient de
 *    poser et la finalise en vraie assignation, exactement comme une
 *    réservation posée avant décision -- aucun changement nécessaire
 *    là-bas.
 *
 * Si l'étape 1 échoue (table pleine entre-temps, etc.), rien n'est décidé :
 * la demande reste refusée, l'agent peut choisir une autre table. Capacité
 * double -- reviewGuestApproval (décider) ET assignGuestApproval (placer) --
 * mêmes rôles qui ont déjà accès aux deux boutons distincts ailleurs
 * (admin, directeur, visibilite).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'reviewGuestApproval') || !hasCapability(user.role, 'assignGuestApproval')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tableId = typeof body.table_id === 'string' && body.table_id ? body.table_id : null;
  if (!tableId) {
    return NextResponse.json({ error: 'table_id_required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { error: reserveError } = await supabase
    .rpc('reserve_table_for_guest_approval', { p_request_id: params.id, p_table_id: tableId, p_agent_id: user.id })
    .single();

  if (reserveError) {
    const status =
      reserveError.message.includes('request_not_found') || reserveError.message.includes('table_not_found')
        ? 404
        : reserveError.message.includes('request_not_pending') || reserveError.message.includes('request_already_assigned')
          ? 409
          : 400;
    return NextResponse.json({ error: reserveError.message }, { status });
  }

  const result = await applyGuestApprovalDecision(supabase, { id: params.id }, 'approuve', 'app', user.id, true);
  if (!result.ok) {
    return NextResponse.json(result, { status: result.reason === 'not_found' ? 404 : 409 });
  }
  return NextResponse.json(result);
}
