'use client';

export interface PendingApprovalsPayload {
  pending_count?: number;
  latest?: { id: string; nom_invite: string | null } | null;
}

let inFlight: Promise<PendingApprovalsPayload | null> | null = null;

/**
 * Trois composants (AccountMenu, BottomNav, GuestApprovalsShortcut) sondent
 * chacun independamment `/api/guest-approvals?count=pending` sur leur propre
 * intervalle (5s/15s/5s) -- confirme dans les logs Vercel (02/10/2026) :
 * comme 15000 est un multiple de 5000, leurs sondages finissent
 * regulierement par tomber dans la meme seconde, declenchant 2-3 requetes
 * reseau identiques simultanees plutot qu'une seule. Reperee en creusant un
 * signalement de "freeze au tap" -- une contention reseau/main thread
 * repetee reste une cause plausible pour qu'une mise a jour de page (sous
 * `document.startViewTransition`) depasse parfois son delai interne (voir
 * app_logs : "View transition update callback timed out").
 *
 * Cette fonction partage la MEME requete en vol entre des appels
 * quasi-simultanes, sans changer la cadence ni l'etat propre a chaque
 * composant -- meme principe que `warmPromise` dans
 * lib/guestApprovalClientCache.ts, applique ici a l'endpoint allege
 * `count=pending` plutot qu'a la liste complete.
 */
export function fetchPendingApprovalsCount(): Promise<PendingApprovalsPayload | null> {
  if (inFlight) return inFlight;
  inFlight = fetch('/api/guest-approvals?count=pending', { cache: 'no-store' })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
