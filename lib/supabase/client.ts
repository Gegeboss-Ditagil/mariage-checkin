'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Client Supabase cote navigateur — utilise la cle anon (publique).
 * Ne peut que LIRE (voir supabase/migrations/0003_rls.sql). Toutes les
 * ecritures passent par les routes API (src/app/api/**) qui utilisent la
 * service role key cote serveur uniquement.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
