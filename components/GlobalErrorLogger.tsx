'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/clientLog';

/**
 * Capture les erreurs qui n'atteignent JAMAIS un error boundary React
 * (app/error.tsx) : une exception dans un gestionnaire d'evenement, un
 * timer, une promesse rejetee sans .catch -- toutes silencieuses jusqu'ici,
 * visibles seulement dans la console du navigateur de la personne devant
 * l'ecran, jamais consultables apres coup. Monte une seule fois au niveau
 * racine (`app/layout.tsx`), meme emplacement que `ServiceWorkerRegister`/
 * `OnlineIndicator` -- systeme de logs applicatifs, demande de Gersom le
 * 17/09/2026 (voir lib/serverLog.ts).
 */
export function GlobalErrorLogger() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportClientError({
        message: event.message || 'Erreur inconnue (window.onerror)',
        stack: event.error?.stack,
        context: { kind: 'window.onerror', filename: event.filename, lineno: event.lineno },
      });
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      reportClientError({
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        context: { kind: 'unhandledrejection' },
      });
    }

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
