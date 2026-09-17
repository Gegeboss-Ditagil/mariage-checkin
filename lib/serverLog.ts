import { createAdminClient } from './supabase/admin.ts';

// Ecrit dans public.app_logs (migration 0057) -- systeme de logs applicatifs
// demande par Gersom le 17/09/2026 : "implemente un systeme de logs
// complets... pour t'aider a te corriger et optimiser le systeme". Best-
// effort et jamais bloquant : logger une erreur ne doit jamais en creer une
// nouvelle ni ralentir la reponse a l'agent -- toute erreur d'ecriture est
// avalee silencieusement (voir catch ci-dessous).
//
// Adoption incrementale : ce helper est disponible pour toute route/fonction
// serveur qui attrape une erreur inattendue (catch), pas encore cable partout
// -- l'ajouter au fil des prochains correctifs plutot que dans un seul lot
// qui toucherait des dizaines de routes juste avant l'evenement.
export interface ServerLogInput {
  event_id?: string | null;
  // 'server' (routes/fonctions serveur, valeur par defaut) ou 'client'
  // (POST /api/public/logs, relaye une erreur survenue dans le navigateur).
  source?: 'server' | 'client';
  level?: 'error' | 'warn' | 'info';
  path?: string | null;
  message: string;
  stack?: string | null;
  digest?: string | null;
  context?: Record<string, unknown>;
}

export async function logServerEvent(input: ServerLogInput): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from('app_logs').insert({
      event_id: input.event_id ?? null,
      source: input.source ?? 'server',
      level: input.level ?? 'error',
      path: input.path ?? null,
      message: input.message.slice(0, 4000),
      stack: input.stack ? input.stack.slice(0, 8000) : null,
      digest: input.digest ?? null,
      context: input.context ?? {},
    });
  } catch {
    // Ne jamais faire echouer l'appelant a cause du systeme de logs lui-meme.
  }
}

export function logServerError(
  error: unknown,
  extra: Omit<ServerLogInput, 'message' | 'stack' | 'level'> = {}
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  void logServerEvent({ ...extra, level: 'error', message, stack });
}
