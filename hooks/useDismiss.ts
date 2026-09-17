'use client';

import { useEffect, useRef, useState } from 'react';

// Duree de l'animation de sortie (voir .sheet-panel-closing / .sheet-card-closing
// / .sheet-backdrop-closing dans app/globals.css). Le panneau reste monte le
// temps de l'animation avant que le vrai onClose (qui demonte/ferme cote
// parent) ne soit appele -- retour de Gersom le 16/09/2026 : "corrige
// fluidifie" les transitions des panneaux modaux (fiche d'approbation,
// camera, selecteur de responsables...), qui jusque-la disparaissaient d'un
// coup, sans jamais d'animation de sortie.
const SHEET_EXIT_MS = 200;

export function useDismiss(onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function dismiss() {
    if (closing) return;
    setClosing(true);
    const reducedMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timerRef.current = setTimeout(() => onCloseRef.current(), reducedMotion ? 0 : SHEET_EXIT_MS);
  }

  return { closing, dismiss };
}
