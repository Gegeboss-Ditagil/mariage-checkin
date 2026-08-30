import type { SupabaseClient } from '@supabase/supabase-js';
import { computeTableCapacities } from '@/lib/capacity';
import { GuestApprovalRequestRow, InvitationRow, OverflowAssignmentRow, TableRow } from '@/lib/types';
import { sendSms, TwilioConfigError, TwilioSendError } from '@/lib/twilio';

/**
 * Places encore libres MAINTENANT sur l'ensemble des tables de réserve --
 * même calcul que /dashboard et /plan-table (lib/capacity.ts), restreint
 * aux tables `is_reserve`. Utilisé pour les deux SMS de suivi ("il vous
 * reste maintenant N places", demande de Gersom le 30/08/2026).
 */
export async function getReserveRemaining(supabase: SupabaseClient, eventId: string): Promise<number> {
  const [{ data: tables }, { data: invitations }, { data: overflow }] = await Promise.all([
    supabase.from('tables').select('*').eq('event_id', eventId),
    supabase.from('invitations').select('*').eq('event_id', eventId),
    supabase.from('overflow_assignments').select('*').eq('event_id', eventId),
  ]);
  const capacities = computeTableCapacities(
    (tables as TableRow[]) || [],
    (invitations as InvitationRow[]) || [],
    (overflow as OverflowAssignmentRow[]) || []
  );
  return capacities.filter((c) => c.table.is_reserve).reduce((sum, c) => sum + c.libresMaintenant, 0);
}

function placesLabel(n: number): string {
  return n + ' place' + (n > 1 ? 's' : '');
}

/**
 * SMS initial à l'approbateur (Papa Gégé ou Papa David selon `guest_approvers`)
 * -- jamais de photo en pièce jointe (numéro français, pas de MMS), juste le
 * lien vers /approve/[token] qui l'affiche à l'ouverture.
 */
export async function notifyApprover(request: GuestApprovalRequestRow, approveUrl: string): Promise<void> {
  const body =
    'Mariage Nelly & Gersom : ' +
    request.nom_invite +
    ' souhaite venir avec ' +
    request.nombre_invites +
    ' invité(s) (côté ' +
    (request.cote === 'Gege' ? 'Gégé' : 'Nelly') +
    '). Voir la photo et répondre : ' +
    approveUrl;
  await sendSms(request.approver_phone, body);
}

/**
 * Confirmation renvoyée à l'approbateur juste après sa décision -- "parfait
 * votre requête a été approuvée, il vous reste maintenant N places" (demande
 * de Gersom). Envoyée aussi en cas de refus (accusé de réception simple),
 * sans le décompte de places (non pertinent, personne n'est ajoutée).
 */
export async function notifyApproverDecision(
  request: GuestApprovalRequestRow,
  decision: 'approuve' | 'refuse',
  reserveRemaining: number
): Promise<void> {
  const body =
    decision === 'approuve'
      ? 'Parfait, votre demande pour ' +
        request.nom_invite +
        ' a été approuvée. Il vous reste maintenant ' +
        placesLabel(reserveRemaining) +
        ' en réserve.'
      : 'Bien reçu : la demande pour ' + request.nom_invite + " n'a pas été approuvée.";
  await sendSms(request.approver_phone, body);
}

/**
 * Rapport au directeur de festin une fois la table effectivement assignée
 * (demande de Gersom) : qui a approuvé, qui arrive, à quelle table, combien
 * de places de réserve restent. Envoyé à tous les numéros de
 * `festin_directors` -- table vide par défaut (numéros pas encore confirmés,
 * voir la migration 0032) : no-op silencieux tant qu'elle l'est, jamais une
 * erreur qui bloquerait l'assignation elle-même.
 */
export async function notifyFestinDirectors(
  supabase: SupabaseClient,
  request: GuestApprovalRequestRow,
  tableNumber: number,
  reserveRemaining: number
): Promise<{ sent: number; failed: number }> {
  const { data: directors } = await supabase.from('festin_directors').select('*');
  const list = directors || [];
  if (list.length === 0) return { sent: 0, failed: 0 };

  const approverLabel = request.cote === 'Gege' ? 'Papa (côté Gégé)' : 'Papa David (côté Nelly)';
  const body =
    approverLabel +
    ' a approuvé ' +
    placesLabel(request.nombre_invites) +
    ' pour ' +
    request.nom_invite +
    '. Ils sont maintenant à la table ' +
    tableNumber +
    ', assignés par le placeur. Il reste maintenant ' +
    placesLabel(reserveRemaining) +
    ' en réserve.';

  let sent = 0;
  let failed = 0;
  for (const director of list) {
    try {
      await sendSms(director.telephone, body);
      sent++;
    } catch (err) {
      // Un directeur injoignable ne doit jamais faire échouer l'assignation
      // de table elle-même (déjà actée en base à ce stade) -- juste compté
      // pour que l'appelant puisse le signaler à l'agent.
      failed++;
      if (!(err instanceof TwilioConfigError) && !(err instanceof TwilioSendError)) throw err;
    }
  }
  return { sent, failed };
}
