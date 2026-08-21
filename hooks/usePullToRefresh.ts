'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Tirer vers le bas (ou revenir sur l'app/l'onglet) relance `onRefresh`.
// Pensé pour rester rapide : `onRefresh` doit rester un simple refetch
// (pas un rechargement complet de la page), donc ça prend une fraction de
// seconde, pas plusieurs minutes.
const PULL_THRESHOLD = 70; // px a tirer avant que ça déclenche le refresh
const MAX_PULL = 110;

export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
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

  // Geste "tirer vers le bas" (uniquement quand on est déjà tout en haut
  // de la page, comme sur les apps natives).
  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      startY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    }
    function onTouchMove(e: TouchEvent) {
      if (startY.current == null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
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

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [runRefresh]);

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
