// v1.75.0 : toute fonction SQL (RPC) qui echoue cote serveur laisse une trace
// dans app_logs (visible sur /admin/logs). Avant, plusieurs appelants
// ignoraient l'erreur sans rien journaliser -- le bug « Reconsiderer -> choisir
// une table » (approuve mais jamais place) est reste invisible pour cette
// raison. Branche une seule fois dans le client admin (lib/supabase/admin.ts),
// donc valable pour les 28 appels RPC de l'application.

export interface RpcFailure {
  rpc: string;
  status: number;
  message: string;
  code: string | null;
}

/** Nom de la fonction si l'URL est un appel RPC PostgREST, sinon null. */
export function rpcNameFromUrl(url: string): string | null {
  const match = url.match(/\/rest\/v1\/rpc\/([A-Za-z0-9_]+)/);
  return match ? match[1] : null;
}

/** Decrit l'echec d'un appel RPC a partir de la reponse HTTP (null si succes ou pas un RPC). */
export function describeRpcFailure(url: string, status: number, bodyText: string): RpcFailure | null {
  const rpc = rpcNameFromUrl(url);
  // >= 300 : PostgREST répond 300 (Multiple Choices) pour une fonction
  // ambiguë (PGRST203) -- exactement le bug de v1.75.0.
  if (!rpc || status < 300) return null;
  let message = bodyText.slice(0, 2000) || 'HTTP ' + status;
  let code: string | null = null;
  try {
    const parsed = JSON.parse(bodyText) as { message?: string; code?: string };
    if (parsed.message) message = parsed.message;
    if (parsed.code) code = parsed.code;
  } catch {
    // corps non JSON : on garde le texte brut
  }
  return { rpc, status, message, code };
}

/**
 * Erreurs metier attendues (refus volontaires des fonctions SQL : table
 * pleine, evenement en mode live...) : journalisees en 'warn', pas 'error'.
 * Tout le reste (fonction absente, ambigue, colonne manquante...) = 'error'.
 */
export function rpcFailureLevel(failure: RpcFailure): 'error' | 'warn' {
  const structural = ['42725', '42883', 'PGRST202', 'PGRST203', '42703', '42P01'];
  if (failure.code && structural.includes(failure.code)) return 'error';
  if (failure.status >= 500) return 'error';
  return /^[a-z_]+$/.test(failure.message) ? 'warn' : 'error';
}
