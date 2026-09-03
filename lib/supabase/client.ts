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

export function createClient(): SupabaseClient {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return client;
}
