'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/clientLog';
import { isStaleDeploymentError, reconnectAfterStaleDeployment } from '@/lib/staleDeployment';
import { isBenignViewTransitionRejection } from '@/lib/viewTransitionNoise';

/**
 * Capture les erreurs qui n'atteignent JAMAIS un error boundary React
 * (app/error.tsx) : une exception dans un gestionnaire d'evenement, un
 * timer, une promesse rejetee sans .catch -- toutes silencieuses jusqu'ici,
 * visibles seulement dans la console du navigateur de la personne devant
 * l'ecran, jamais consultables apres coup. Monte une seule fois au niveau
 * racine (`app/layout.tsx`), meme emplacement que `ServiceWorkerRegister`/
 * `OnlineIndicator` -- systeme de logs applicatifs, demande de Gersom le
 * 17/09/2026 (voir lib/serverLog.ts).
 *
 * v1.58.0, bug reel trouve en creusant un signalement de "freeze au tap" :
 * `app/error.tsx` sait deja detecter une vraie erreur de bundle perime
 * (ChunkLoadError...) et forcer une reconnexion -- mais seulement pour une
 * erreur qui remonte comme un rendu React jete. Une erreur du meme type
 * survenant dans un callback ASYNCHRONE (ex: le `update` callback d'un
 * `document.startViewTransition`, utilise par `next-view-transitions` pour
 * chaque navigation -- confirme par app_logs : "View transition update
 * callback timed out" capture sur un appareil reel apres plusieurs
 * deploiements rapproches le meme jour) ne declenche JAMAIS ce rendu --
 * elle n'atteint que ces deux ecouteurs globaux, qui se contentaient
 * jusqu'ici de la journaliser sans jamais reconnecter : l'app restait sur un
 * bundle perime, sans jamais redemander de connexion, jusqu'a ce qu'une
 * autre erreur "pour de vrai" finisse par passer par app/error.tsx -- d'ou
 * le symptome observe ("ca ne redemande meme pas de login... et la je sais
 * que ca va buguer").
 */
export function GlobalErrorLogger() {
  useEffect(() => {
    function onError(event: ErrorEvent) {
      reportClientError({
        message: event.message || 'Erreur inconnue (window.onerror)',
        stack: event.error?.stack,
        context: { kind: 'window.onerror', filename: event.filename, lineno: event.lineno },
      });
      if (isStaleDeploymentError({ name: event.error?.name, message: event.message })) {
        void reconnectAfterStaleDeployment();
      }
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      // v1.63.0 : une navigation rapide (plusieurs clics avant la fin du
      // fondu) fait annuler la View Transition precedente par le
      // navigateur lui-meme -- attendu, jamais un bug. La signaler comme
      // une vraie erreur (en plus du travail de serialisation/sendBeacon
      // que ca declenche, exactement pendant la fenetre ou le clic rapide
      // peut deja faire flasher l'ecran) noyait les signaux reels.
      if (isBenignViewTransitionRejection(message)) {
        event.preventDefault();
        return;
      }
      reportClientError({
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
        context: { kind: 'unhandledrejection' },
      });
      if (isStaleDeploymentError({ name: reason instanceof Error ? reason.name : undefined, message })) {
        void reconnectAfterStaleDeployment();
      }
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
