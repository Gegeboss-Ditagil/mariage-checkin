import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Client Supabase "admin" — utilise la SERVICE ROLE KEY. Contourne RLS.
 * SERVEUR UNIQUEMENT (routes API / server components) — ne jamais importer
 * ce fichier depuis un composant client ('use client').
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent etre definis (.env.local)'
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
