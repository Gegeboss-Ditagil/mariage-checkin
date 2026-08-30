import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSessionUser } from '@/lib/session';
import { hasCapability } from '@/lib/permissions';
import { getReserveRemaining, notifyFestinDirectors } from '@/lib/guestApprovalNotify';
import { GuestApprovalRequestRow } from '@/lib/types';

/**
 * Finalise une demande d'invité surprise déjà APPROUVÉE : crée l'invitation
 * à la table choisie (RPC assign_table_to_guest_approval, migration 0032),
 * puis envoie le SMS de rapport au directeur de festin (festin_directors).
 * Capacité guestApproval -- volontairement PAS addInvitation (réservée à
 * l'admin, voir /api/invitations/add) : action étroite qui ne peut agir que
 * sur une demande déjà approuvée par SMS, pas un droit général d'ajout.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getSessionUser();
  if (!user || !hasCapability(user.role, 'guestApproval')) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const tableId = typeof body.table_id === 'string' ? body.table_id : null;
  if (!tableId) {
    return NextResponse.json({ error: 'table_id_required' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: invitation, error } = await supabase
    .rpc('assign_table_to_guest_approval', {
      p_request_id: params.id,
      p_table_id: tableId,
      p_agent_id: user.id,
    })
    .single();

  if (error) {
    const status =
      error.message.includes('request_not_found') || error.message.includes('table_not_found')
        ? 404
        : error.message.includes('request_not_approved') || error.message.includes('request_already_assigned')
          ? 409
          : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  const { data: request } = await supabase
    .from('guest_approval_requests')
    .select('*')
    .eq('id', params.id)
    .maybeSingle<GuestApprovalRequestRow>();
  const { data: table } = await supabase.from('tables').select('number').eq('id', tableId).maybeSingle();

  let directorReport: { sent: number; failed: number } | null = null;
  if (request && table) {
    const reserveRemaining = await getReserveRemaining(supabase, request.event_id);
    try {
      directorReport = await notifyFestinDirectors(supabase, request, table.number, reserveRemaining);
    } catch {
      directorReport = { sent: 0, failed: 0 };
    }
  }

  return NextResponse.json({ invitation, director_report: directorReport });
}
