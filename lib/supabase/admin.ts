import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { describeRpcFailure, rpcFailureLevel } from '../rpcErrorLog.ts';

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
    global: { fetch: rpcLoggingFetch(url, serviceKey) },
  });
}

/**
 * v1.75.0 : enveloppe fetch du client admin. Si un appel RPC echoue, ecrit une
 * ligne dans app_logs (best-effort, jamais attendu, jamais bloquant) -- plus
 * aucune erreur SQL ne peut etre avalee sans trace par un appelant.
 */
function rpcLoggingFetch(url: string, serviceKey: string): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, init);
    if (!response.ok) {
      const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      void response
        .clone()
        .text()
        .then((body) => {
          const failure = describeRpcFailure(requestUrl, response.status, body);
          if (!failure) return;
          return fetch(url + '/rest/v1/app_logs', {
            method: 'POST',
            headers: {
              apikey: serviceKey,
              Authorization: 'Bearer ' + serviceKey,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body: JSON.stringify({
              source: 'server',
              level: rpcFailureLevel(failure),
              path: 'rpc/' + failure.rpc,
              message: 'RPC ' + failure.rpc + ' : ' + failure.message,
              context: { status: failure.status, code: failure.code },
            }),
          });
        })
        .catch(() => {
          // Journaliser ne doit jamais faire echouer l'appel d'origine.
        });
    }
    return response;
  };
}
