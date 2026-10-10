'use client';

import { useEffect, useRef } from 'react';

// v1.76.0, trouvé par le balayage « clique partout » : les fiches de
// /agenda et le code affiché par /mots-de-passe ne se fermaient pas avec la
// touche Échap (clavier d'ordinateur ou de tablette), contrairement à la
// fiche d'approbation et au menu du compte. `active` = fiche ouverte.
export function useEscapeKey(active: boolean, onEscape: () => void) {
  const handler = useRef(onEscape);
  handler.current = onEscape;
  useEffect(() => {
    if (!active) return;
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handler.current();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [active]);
}
