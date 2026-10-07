'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase cote navigateur — utilise la cle anon (publique).
 * Ne peut que LIRE (voir supabase/migrations/0003_rls.sql). Toutes les
 * ecritures passent par les routes API (src/app/api/**) qui utilisent la
 * service role key cote serveur uniquement.
 *
 * Instance UNIQUE par onglet (module-scoped) : chaque page appelait
 * `createClient()` a nouveau dans chaque effet ou fonction load(), ce qui
 * recree le client, son state Realtime et ses websockets a chaque montage.
 * Un singleton partage les canaux et evite des connexions en double.
 */
let client: SupabaseClient | null = null;

// v1.71.0, demande de Gersom : « il y aura une connectivité peut-être réduite
// sur place, assure-toi que ça n'impacte pas trop l'app ». Sans délai maximal,
// une lecture lancée sur un réseau saturé (salle pleine, 4G faible) pouvait
// rester bloquée indéfiniment sur « Chargement… » au lieu de tomber en erreur
// et laisser la page réessayer (polling, retour au premier plan, tirer pour
// rafraîchir). Ce client ne fait que des LECTURES (les écritures passent par
// les routes API, non concernées) : couper une lecture trop lente ne perd
// jamais de donnée. Les websockets Realtime ne passent pas par ce fetch.
export const SUPABASE_READ_TIMEOUT_MS = 15_000;

export function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const timeout = AbortSignal.timeout?.(SUPABASE_READ_TIMEOUT_MS);
  let signal = init.signal ?? timeout;
  // Combine le signal de l'appelant et le délai quand le navigateur le
  // permet (iOS 17.4+, Chrome 116+) ; sinon on garde celui de l'appelant.
  if (init.signal && timeout && typeof AbortSignal.any === 'function') {
    signal = AbortSignal.any([init.signal, timeout]);
  }
  return fetch(input, { ...init, signal: signal ?? undefined });
}

export function createClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { fetch: fetchWithTimeout } }
    );
  }
  return client;
}
