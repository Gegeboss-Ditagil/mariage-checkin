'use client';

import { useEffect, useRef } from 'react';

/**
 * Lance `fn` toutes les `delayMs` ms, mais PAUSE l'intervalle quand l'onglet
 * ou la PWA passe en arriere-plan (`visibilitychange`) et le reprend au
 * retour. Les badges (approbations), l'agenda, la liste staff... n'ont aucune
 * raison de sonder le reseau quand personne ne regarde l'ecran -- sur le jour
 * J avec ~20 tablettes ouvertes, ces sondages en arriere-plan representaient
 * des dizaines de requetes inutiles par minute.
 *
 * Passez `delayMs` a 0 (ou <= 0) pour desactiver completement le poll.
 */
export function usePolling(fn: () => void | Promise<void>, delayMs: number) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (delayMs <= 0) return;
    // window.setInterval/clearInterval : numerique dans le DOM, evite le
    // conflit de types avec le global setInterval de @types/node.
    let timer: number | null = null;

    const start = () => {
      if (timer === null) timer = window.setInterval(() => void fnRef.current(), delayMs);
    };
    const stop = () => {
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [delayMs]);
}