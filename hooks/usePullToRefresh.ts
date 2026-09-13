'use client';

import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

// Tirer vers le bas (ou revenir sur l'app/l'onglet) relance `onRefresh`.
// Pensé pour rester rapide : `onRefresh` doit rester un simple refetch
// (pas un rechargement complet de la page), donc ça prend une fraction de
// seconde, pas plusieurs minutes.
const PULL_THRESHOLD = 70; // px a tirer avant que ça déclenche le refresh
const MAX_PULL = 110;

// `containerRef` doit pointer vers le conteneur réellement défilant de la
// page (le `overflow-y-auto`, pas `window`) -- corrige le 13/09/2026 (retour
// de Gersom : "j'appuie sur le bouton... je scroll... ça bug, ça ne reste
// pas figé... je ne peux plus cliquer au milieu"). Chaque page de l'appli
// défile via un `<div overflow-y-auto>` interne (`html`/`body` restent
// volontairement figés, voir le conteneur racine `fixed inset-0` de chaque
// page) : `window.scrollY` y est donc TOUJOURS 0, quel que soit le défilement
// réel -- le garde-fou "seulement en haut de page" ne protégeait jamais
// rien, et "tirer vers le bas" pouvait se déclencher au milieu d'un
// défilement normal, n'importe où sur l'écran (les écouteurs vivaient sur
// `window`, pas sur le conteneur). Repris du correctif déjà fait sur
// /plan-table le même jour (`scrollRef.current.scrollTop`, garde
// `e.touches.length > 1`) plutôt que d'écrire une deuxième fois cette
// logique : `containerRef` est optionnel pour ne pas casser un appelant qui
// ne l'a pas encore (comportement alors identique à avant, gardé en filet).
export function usePullToRefresh(onRefresh: () => Promise<void> | void, containerRef?: RefObject<HTMLElement | null>) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const startY = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    pullDistanceRef.current = pullDistance;
  }, [pullDistance]);

  const runRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefreshRef.current();
    } finally {
      setRefreshing(false);
      setPulling(false);
      setPullDistance(0);
    }
  }, []);

  const reset = useCallback(() => {
    startY.current = null;
    setPulling(false);
    setPullDistance(0);
  }, []);

  // Geste "tirer vers le bas" (uniquement quand on est déjà tout en haut
  // du conteneur qui défile réellement, comme sur les apps natives).
  useEffect(() => {
    function atTop() {
      return containerRef ? (containerRef.current?.scrollTop ?? 0) <= 0 : window.scrollY <= 0;
    }
    function onTouchStart(e: TouchEvent) {
      // Un pincement (deux doigts) ne doit jamais démarrer ce suivi --
      // même garde que /plan-table, pour un conteneur qui zoomerait aussi.
      startY.current = e.touches.length === 1 && atTop() ? e.touches[0].clientY : null;
    }
    function onTouchMove(e: TouchEvent) {
      if (e.touches.length > 1) {
        reset();
        return;
      }
      if (startY.current == null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && atTop()) {
        setPulling(true);
        setPullDistance(Math.min(delta, MAX_PULL));
      }
    }
    function onTouchEnd() {
      if (startY.current == null) return;
      startY.current = null;
      if (pullDistanceRef.current >= PULL_THRESHOLD) {
        runRefresh();
      } else {
        setPulling(false);
        setPullDistance(0);
      }
    }
    // Le système annule parfois la séquence tactile sans jamais déclencher
    // touchend (le navigateur reprend le geste comme un défilement natif,
    // un appel entrant interrompt, etc.) -- sans ce filet, `startY` restait
    // non nul et l'indicateur "tirez pour actualiser" pouvait rester
    // affiché/figé indéfiniment, décalant la mise en page sous lui.
    function onTouchCancel() {
      reset();
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [runRefresh, reset, containerRef]);

  // Rafraîchit aussi automatiquement dès qu'on revient sur l'écran/l'app
  // (téléphone qui se réveille, PWA remise au premier plan, onglet qui
  // redevient actif) — utile quand le websocket temps réel s'est endormi
  // en arrière-plan et n'a pas repris la connexion tout seul. Pas besoin
  // de penser à tirer vers le bas dans ce cas, ça se fait automatiquement.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') runRefresh();
    }
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [runRefresh]);

  return { pulling, pullDistance, refreshing, pullThreshold: PULL_THRESHOLD };
}
