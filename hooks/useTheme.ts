'use client';

import { useCallback, useEffect, useState } from 'react';

// Trois preferences possibles : 'light'/'dark' fixent le mode, 'system'
// suit prefers-color-scheme de l'appareil en direct (utile pour le staff qui
// bascule entre l'exterieur en plein jour et la salle en soiree). La cle
// localStorage 'checkin-theme' est inchangee depuis v1.20.0 : une ancienne
// valeur 'light'|'dark' deja en storage reste valide telle quelle, il n'y a
// rien a migrer activement -- c'est deja une valeur de ThemePref valide.
export type ThemePref = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'checkin-theme';
const CHOSEN_KEY = 'checkin-theme-chosen';
const THEME_COLOR: Record<Theme, string> = { light: '#f4f4f7', dark: '#14141a' };

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolve(pref: ThemePref): Theme {
  if (pref === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return pref;
}

function readStoredPref(): ThemePref {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'dark' || stored === 'light' || stored === 'system' ? stored : 'light';
}

function applyEffective(effective: Theme) {
  document.documentElement.dataset.theme = effective;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[effective]);
}

export function useTheme(): {
  pref: ThemePref;
  theme: Theme;
  setTheme: (next: ThemePref) => void;
  hasChosenTheme: boolean;
  markThemeChosen: () => void;
} {
  const [pref, setPrefState] = useState<ThemePref>('light');
  const [theme, setThemeState] = useState<Theme>('light');
  const [hasChosenTheme, setHasChosenTheme] = useState(true);

  useEffect(() => {
    const storedPref = readStoredPref();
    setPrefState(storedPref);
    setThemeState(resolve(storedPref));
    setHasChosenTheme(window.localStorage.getItem(CHOSEN_KEY) === '1');
  }, []);

  // Suit le systeme en direct uniquement quand la preference est
  // 'Automatique' -- pas d'abonnement sinon (mode fixe volontaire).
  useEffect(() => {
    if (pref !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange() {
      const effective = resolve('system');
      setThemeState(effective);
      applyEffective(effective);
    }
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [pref]);

  useEffect(() => {
    applyEffective(theme);
  }, [theme]);

  const setTheme = useCallback((next: ThemePref) => {
    setPrefState(next);
    const effective = resolve(next);
    setThemeState(effective);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyEffective(effective);
  }, []);

  const markThemeChosen = useCallback(() => {
    window.localStorage.setItem(CHOSEN_KEY, '1');
    setHasChosenTheme(true);
  }, []);

  return { pref, theme, setTheme, hasChosenTheme, markThemeChosen };
}
