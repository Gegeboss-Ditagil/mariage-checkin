import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { GuestApprovalRequestRow } from '@/lib/types';

/**
 * Réserve (ou libère) une table pour une demande d'invité surprise encore
 * EN ATTENTE -- avant même l'approbation SMS/WhatsApp/application. Ne crée
 * jamais d'invitation : juste une intention (reserved_table_id, voir
 * 0044_guest_approval_pre_approval_reservation.sql) qui compte dans le
 * calcul de capacité pendant que la demande reste en attente, pour ne pas
 * pouvoir la double-booker avec une autre réservation. Automatiquement
 * finalisée en vraie assignation dès l'approbation (lib/guestApprovalDecide.ts)
 * ou libérée au refus. Même capacité que l'assignation post-approbation
 * (assignGuestApproval) -- ce sont les mêmes rôles qui placent les tables.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'assignGuestApproval')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tableId = typeof body.table_id === 'string' && body.table_id ? body.table_id : null;

  const supabase = createAdminClient();

  const { data, error } = tableId
    ? await supabase
        .rpc('reserve_table_for_guest_approval', { p_request_id: params.id, p_table_id: tableId, p_agent_id: user.id })
        .single()
    : await supabase
        .rpc('release_guest_approval_reservation', { p_request_id: params.id, p_agent_id: user.id })
        .single();

  if (error) {
    const status =
      error.message.includes('request_not_found') || error.message.includes('table_not_found')
        ? 404
        : error.message.includes('request_not_pending') || error.message.includes('request_already_assigned')
          ? 409
          : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ request: data as GuestApprovalRequestRow });
}
