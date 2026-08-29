'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'checkin-theme';

// Doit rester synchrone avec le script bloquant injecte dans <head> par
// app/layout.tsx (qui pose déjà data-theme avant le premier rendu pour
// éviter un flash) -- ne change ni la clé ni les valeurs sans mettre à jour
// les deux endroits.
function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

/** Theme clair/sombre choisi par l'utilisateur, persiste sur l'appareil (pas de synchronisation entre appareils). */
export function useTheme(): { theme: Theme; setTheme: (next: Theme) => void } {
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    setThemeState(readStoredTheme());
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    document.documentElement.dataset.theme = next;
  }, []);

  return { theme, setTheme };
}
