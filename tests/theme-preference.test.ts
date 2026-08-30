import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// hooks/useTheme.ts s'appuie sur window/localStorage/matchMedia (aucun DOM
// sous node:test, pas de jsdom dans ce projet) -- meme convention que les
// fichiers .tsx du dossier (voir guest-arrival-panel.test.ts) : inspection du
// code source plutot qu'execution directe.
const themeHookSource = readFileSync(new URL('../hooks/useTheme.ts', import.meta.url), 'utf8');
const layoutSource = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const onboardingSource = readFileSync(new URL('../app/onboarding/theme/page.tsx', import.meta.url), 'utf8');
const loginSource = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
const accountMenuSource = readFileSync(new URL('../components/AccountMenu.tsx', import.meta.url), 'utf8');
const middlewareSource = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');

test("la cle localStorage 'checkin-theme' est inchangee depuis v1.20.0 (pas de migration active necessaire)", () => {
  assert.match(themeHookSource, /const STORAGE_KEY = 'checkin-theme';/);
  // Une ancienne valeur 'light'|'dark' deja en storage est deja une valeur
  // valide de ThemePref -- readStoredPref() la garde telle quelle.
  assert.match(themeHookSource, /stored === 'dark' \|\| stored === 'light' \|\| stored === 'system'/);
});

test('trois preferences possibles, resolues vers un theme effectif clair/sombre', () => {
  assert.match(themeHookSource, /export type ThemePref = 'light' \| 'dark' \| 'system';/);
  assert.match(themeHookSource, /function resolve\(pref: ThemePref\): Theme/);
  assert.match(themeHookSource, /if \(pref === 'system'\) return systemPrefersDark\(\) \? 'dark' : 'light';/);
});

test("'Automatique' suit prefers-color-scheme en direct via matchMedia, uniquement quand pref==='system'", () => {
  assert.match(themeHookSource, /matchMedia\('\(prefers-color-scheme: dark\)'\)/);
  assert.match(themeHookSource, /mql\.addEventListener\('change', onChange\)/);
  assert.match(themeHookSource, /if \(pref !== 'system' \|\| typeof window === 'undefined' \|\| !window\.matchMedia\) return;/);
});

test('setTheme persiste la preference et pose data-theme + meta theme-color', () => {
  assert.match(themeHookSource, /window\.localStorage\.setItem\(STORAGE_KEY, next\)/);
  assert.match(themeHookSource, /document\.documentElement\.dataset\.theme = effective/);
  assert.match(themeHookSource, /meta\.setAttribute\('content', THEME_COLOR\[effective\]\)/);
});

test('le script anti-flash de app/layout.tsx resout aussi "system" avant le premier rendu', () => {
  assert.match(layoutSource, /t==='system'&&window\.matchMedia/);
  assert.match(layoutSource, /theme-color/);
});

test("l'onboarding de theme s'affiche une seule fois (drapeau checkin-theme-chosen) et route vers landingPathForRole", () => {
  assert.match(themeHookSource, /const CHOSEN_KEY = 'checkin-theme-chosen';/);
  assert.match(onboardingSource, /markThemeChosen/);
  assert.match(onboardingSource, /landingPathForRole\(role\)/);
  assert.match(onboardingSource, /title: 'Sombre — Maison'/);
  assert.match(onboardingSource, /title: 'Clair — Atrium'/);
});

test('le login redirige vers /onboarding/theme apres la premiere connexion, sinon garde la destination normale', () => {
  assert.match(loginSource, /checkin-theme-chosen/);
  assert.match(loginSource, /\/onboarding\/theme\?next=/);
});

test('le middleware laisse passer /onboarding pour tout role authentifie (pas de capacite dediee)', () => {
  assert.match(middlewareSource, /pathname\.startsWith\('\/onboarding'\)/);
});

test('le menu de compte propose un segmented control a 3 positions (Sombre/Clair/Auto), plus le 2-boutons v1.20.0', () => {
  assert.match(accountMenuSource, /THEME_CHOICES/);
  assert.match(accountMenuSource, /pref: 'dark'/);
  assert.match(accountMenuSource, /pref: 'light'/);
  assert.match(accountMenuSource, /pref: 'system'/);
});
