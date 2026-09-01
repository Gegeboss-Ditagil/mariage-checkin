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
  decidedVia: 'web' | 'whatsapp' | 'app'
): Promise<DecideResult> {
  let requestId: string | null = null;

  if ('token' in lookup || 'id' in lookup) {
    const column = 'token' in lookup ? 'token' : 'id';
    const value = 'token' in lookup ? lookup.token : lookup.id;
    const { data: updated } = await supabase
      .from('guest_approval_requests')
      .update({ statut: decision, decided_at: new Date().toISOString(), decided_via: decidedVia })
      .eq(column, value)
      .eq('statut', 'en_attente')
      .select('*')
      .maybeSingle<GuestApprovalRequestRow>();

    if (updated) return finalizeDecision(supabase, updated, decision);

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
  decision: 'approuve' | 'refuse'
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

  const reserveRemaining = await getReserveRemaining(supabase, updated.event_id);
  try {
    await notifyApproverDecision(updated, decision, reserveRemaining);
  } catch {
    // Le SMS/WhatsApp de confirmation est un bonus, pas une condition de
    // succès de la décision elle-même -- déjà actée en base au-dessus.
  }
  if (decision === 'approuve') {
    try {
      await notifyGuestApprovalPlaceurs(supabase, updated, null);
    } catch {
      // La notification push est best-effort; la décision reste valide.
    }
  }

  return { ok: true, request: updated };
}
