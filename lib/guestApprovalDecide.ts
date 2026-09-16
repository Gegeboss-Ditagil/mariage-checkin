import type { SupabaseClient } from '@supabase/supabase-js';
import { GuestApprovalRequestRow, GuestApprovalStatut } from '@/lib/types';
import { getReserveRemaining, notifyApproverDecision } from '@/lib/guestApprovalNotify';
import { notifyGuestApprovalPlaceurs } from '@/lib/webPush';

export type DecideLookup = { token: string } | { phoneMostRecentPending: string } | { id: string };
export type DecideResult =
  | { ok: true; request: GuestApprovalRequestRow }
  | { ok: false; reason: 'not_found' }
  | { ok: false; reason: 'already_decided'; statut: GuestApprovalStatut };

/**
 * Applique une décision (approuver/refuser) sur une demande, quel que soit
 * le canal d'entrée -- utilisée par la page publique `/approve/[token]`
 * (lookup par token) et par le webhook WhatsApp entrant
 * (`app/api/public/twilio/whatsapp-inbound`, lookup par téléphone : une
 * réponse WhatsApp en texte libre ne porte pas de token, on retrouve donc la
 * demande la plus récente encore `en_attente` pour ce numéro).
 *
 * Atomique dans les deux cas : le UPDATE est gardé par `statut = 'en_attente'`
 * dans le WHERE (verrouillage de ligne Postgres implicite), un deuxième appel
 * concurrent touche 0 ligne -- jamais une double décision silencieuse.
 */
export async function applyGuestApprovalDecision(
  supabase: SupabaseClient,
  lookup: DecideLookup,
  decision: 'approuve' | 'refuse',
  decidedVia: 'web' | 'whatsapp' | 'app',
  // Agent qui decide, quand connu (decide "app" par un membre du staff
  // connecte) -- absent pour les canaux externes (lien web public, WhatsApp,
  // ou le parent approbateur n'a pas de compte). Sert uniquement a
  // finaliser une reservation de table pre-approbation (voir
  // 0044_guest_approval_pre_approval_reservation.sql) ; jamais requis.
  decidedByAgentId?: string,
  // Permet de revenir sur un refus par erreur -- demande de Gersom le
  // 13/09/2026 : "si j'ai refusé, je peux recliquer dessus et refaire...
  // au cas où c'était une erreur, les réapprouver par la suite". Vrai
  // uniquement depuis /api/guest-approvals/[id]/decide (jamais depuis le
  // lien public /approve/[token] ni WhatsApp, canaux externes ou un tiers
  // pourrait rouvrir une decision deja communiquee). Un-directionnel :
  // seul refuse -> approuve est permis (jamais l'inverse -- une demande
  // deja approuvee peut avoir une table assignee, defaire ça est une tout
  // autre operation, non demandee ici).
  allowReconsiderFromRefused = false
): Promise<DecideResult> {
  let requestId: string | null = null;

  if ('token' in lookup || 'id' in lookup) {
    const column = 'token' in lookup ? 'token' : 'id';
    const value = 'token' in lookup ? lookup.token : lookup.id;
    const eligibleStatuts =
      allowReconsiderFromRefused && decision === 'approuve' ? ['en_attente', 'refuse'] : ['en_attente'];
    const { data: updated } = await supabase
      .from('guest_approval_requests')
      .update({ statut: decision, decided_at: new Date().toISOString(), decided_via: decidedVia })
      .eq(column, value)
      .in('statut', eligibleStatuts)
      .select('*')
      .maybeSingle<GuestApprovalRequestRow>();

    if (updated) return finalizeDecision(supabase, updated, decision, decidedByAgentId);

    const { data: existing } = await supabase
      .from('guest_approval_requests')
      .select('statut')
      .eq(column, value)
      .maybeSingle();
    if (existing) return { ok: false, reason: 'already_decided', statut: existing.statut };
    return { ok: false, reason: 'not_found' };
  }

  // Lookup par téléphone (WhatsApp) : la demande la plus récente encore en
  // attente pour ce numéro -- si plusieurs demandes étaient en attente pour
  // le même approbateur en même temps (rare pour un mariage), c'est la plus
  // récente qui reçoit la réponse en texte libre, faute d'un moyen de
  // désambiguïser dans un simple "Oui"/"Non".
  const { data: pending } = await supabase
    .from('guest_approval_requests')
    .select('id')
    .eq('approver_phone', lookup.phoneMostRecentPending)
    .eq('statut', 'en_attente')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pending) return { ok: false, reason: 'not_found' };
  requestId = pending.id;

  const { data: updated } = await supabase
    .from('guest_approval_requests')
    .update({ statut: decision, decided_at: new Date().toISOString(), decided_via: decidedVia })
    .eq('id', requestId)
    .eq('statut', 'en_attente')
    .select('*')
    .maybeSingle<GuestApprovalRequestRow>();

  if (!updated) return { ok: false, reason: 'not_found' }; // decide entre-temps par une autre reponse concurrente
  return finalizeDecision(supabase, updated, decision);
}

async function finalizeDecision(
  supabase: SupabaseClient,
  updated: GuestApprovalRequestRow,
  decision: 'approuve' | 'refuse',
  decidedByAgentId?: string
): Promise<DecideResult> {
  await supabase.from('audit_logs').insert({
    event_id: updated.event_id,
    action: 'guest_approval_decided',
    details: {
      request_id: updated.id,
      nom_invite: updated.nom_invite,
      nombre_invites: updated.nombre_invites,
      cote: updated.cote,
      decision,
      via: updated.decided_via,
    },
  });

  // Reservation posee AVANT l'approbation (voir 0044) : la finalise
  // immediatement en vraie assignation (meme RPC atomique que
  // l'assignation manuelle post-approbation, 0038) au lieu de laisser
  // l'agent repasser par /approbations/[id]/assign pour une table deja
  // choisie. Au refus, la reservation n'a jamais cree d'invitation : on la
  // libere simplement pour ne pas laisser une colonne orpheline. Ce
  // mecanisme reste disponible (route reserve-table) mais n'est plus le
  // parcours principal depuis le 02/09/2026 -- voir la branche suivante.
  let tableNumber: number | null = null;
  if (decision === 'approuve' && updated.reserved_table_id && !updated.table_id) {
    const { data: assigned, error: assignError } = await supabase.rpc('assign_table_to_guest_approval_strict', {
      p_request_id: updated.id,
      p_table_id: updated.reserved_table_id,
      p_agent_id: decidedByAgentId ?? null,
    });
    if (!assignError && assigned) {
      const { data: refreshed } = await supabase
        .from('guest_approval_requests')
        .select('*, table:table_id(number)')
        .eq('id', updated.id)
        .maybeSingle<GuestApprovalRequestRow & { table: { number: number } | null }>();
      if (refreshed) {
        updated = refreshed;
        tableNumber = refreshed.table?.number ?? null;
      }
    }
    // Si la finalisation echoue (capacite reprise entre-temps par une autre
    // reservation, table supprimee...), la demande reste approuvee mais
    // sans table -- meme filet de securite que l'assignation manuelle,
    // jamais de double booking silencieux. L'agent reprend alors la main
    // depuis /approbations, comme avant cette fonctionnalite.
  } else if (decision === 'approuve' && !updated.table_id) {
    // Placement automatique -- demande de Gersom le 02/09/2026 : "je n'ai
    // pas besoin de voir reserver une table directement... etre capable de
    // approuver ou refuser rapidement". Priorite table excedentaire, puis
    // la table avec le plus de place libre du meme cote, puis l'autre cote
    // (voir 0045_auto_assign_table_for_guest_approval.sql).
    const { data: assigned, error: autoAssignError } = await supabase.rpc('auto_assign_table_for_guest_approval', {
      p_request_id: updated.id,
      p_agent_id: decidedByAgentId ?? null,
    });
    if (!autoAssignError && assigned) {
      const { data: refreshed } = await supabase
        .from('guest_approval_requests')
        .select('*, table:table_id(number)')
        .eq('id', updated.id)
        .maybeSingle<GuestApprovalRequestRow & { table: { number: number } | null }>();
      if (refreshed) {
        updated = refreshed;
        tableNumber = refreshed.table?.number ?? null;
      }
    }
    // Si aucune table n'a de place nulle part, la demande reste approuvee
    // sans table -- jamais de double booking silencieux ; un placeur ou
    // directeur reprend la main manuellement depuis /approbations.
  } else if (decision === 'refuse' && updated.reserved_table_id) {
    await supabase.rpc('release_guest_approval_reservation', {
      p_request_id: updated.id,
      p_agent_id: decidedByAgentId ?? null,
    });
    updated = { ...updated, reserved_table_id: null };
  }

  const reserveRemaining = await getReserveRemaining(supabase, updated.event_id);
  // v1.53.2 : `events.twilio_enabled` (migration 0055) remplace l'ancienne
  // variable d'environnement TWILIO_ENABLED -- voir lib/twilio.ts.
  const { data: eventRow } = await supabase
    .from('events')
    .select('twilio_enabled')
    .eq('id', updated.event_id)
    .maybeSingle();
  const twilioEnabled = eventRow?.twilio_enabled ?? false;
  // v1.48.3, retour de Gersom : "les trois petits points restent là très
  // longtemps" en approuvant/reconsidérant -- ces deux envois sont chacun
  // best-effort et indépendants l'un de l'autre (SMS/WhatsApp de
  // confirmation à l'approbateur, Push aux placeurs), mais étaient attendus
  // en séquence (l'un après l'autre) au lieu d'en parallèle, doublant le
  // temps d'attente pour rien. Lancés ensemble désormais -- toujours
  // rattrapés individuellement (voir `.catch` ci-dessous), jamais une
  // condition de succès de la décision elle-même, déjà actée en base
  // au-dessus. Bornés en plus à 8s chacun (lib/twilio.ts, lib/webPush.ts).
  await Promise.allSettled([
    notifyApproverDecision(updated, decision, reserveRemaining, twilioEnabled).catch(() => {
      // Le SMS/WhatsApp de confirmation est un bonus, pas une condition de
      // succès de la décision elle-même -- déjà actée en base au-dessus.
    }),
    decision === 'approuve'
      ? notifyGuestApprovalPlaceurs(supabase, updated, tableNumber).catch(() => {
          // La notification push est best-effort; la décision reste valide.
        })
      : Promise.resolve(),
  ]);

  return { ok: true, request: updated };
}
