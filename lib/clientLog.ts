'use client';

// Signale une erreur cote client a POST /api/public/logs -- systeme de logs
// applicatifs (voir lib/serverLog.ts, migration 0057_app_logs.sql). Best-
// effort, jamais bloquant, jamais throw : un signalement d'erreur ne doit
// jamais en provoquer une nouvelle.
//
// Dedoublonnage simple en memoire (par onglet) : un meme message signale
// plusieurs fois de suite (ex: une erreur qui se reproduit a chaque re-rendu
// dans une boucle) n'est envoye qu'une fois par fenetre de 10s, pour ne
// jamais spammer le reseau ni la table pendant un vrai incident.
const recentlyReported = new Map<string, number>();
const DEDUPE_WINDOW_MS = 10_000;

export function reportClientError(input: {
  message: string;
  stack?: string | null;
  digest?: string | null;
  path?: string;
  level?: 'error' | 'warn' | 'info';
  context?: Record<string, unknown>;
}) {
  try {
    const key = input.message.slice(0, 300);
    const now = Date.now();
    const last = recentlyReported.get(key);
    if (last && now - last < DEDUPE_WINDOW_MS) return;
    recentlyReported.set(key, now);

    const body = JSON.stringify({
      message: input.message,
      stack: input.stack ?? undefined,
      digest: input.digest ?? undefined,
      path: input.path ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
      level: input.level ?? 'error',
      context: input.context ?? {},
    });

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      // sendBeacon survit a une navigation/fermeture d'onglet immediate
      // (exactement le cas d'une erreur qui precede un retour a /login) --
      // prefere a fetch quand disponible.
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/public/logs', blob);
      return;
    }

    void fetch('/api/public/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Jamais faire echouer l'appelant a cause du signalement lui-meme.
  }
}
