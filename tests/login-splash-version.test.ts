import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// v1.60.0, retour de Gersom (02/10/2026) : "ajouter le numero de version sur
// la page de login, en plus du splash page" + "faire le splash page au
// debut, juste un tout petit peu plus court". Tests par inspection du
// source (meme convention que tests/navigation-resilience.test.ts pour ce
// genre de verification d'affichage), pas de rendu React complet necessaire.

const loginSource = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');
const splashSource = readFileSync(new URL('../components/SplashScreen.tsx', import.meta.url), 'utf8');

test("/login importe la version depuis package.json et l'affiche (v{version})", () => {
  assert.match(loginSource, /import\s*\{\s*version\s*\}\s*from\s*['"]@\/package\.json['"]/);
  assert.match(loginSource, /v\{version\}/);
});

test('le splash est raccourci (SPLASH_DURATION_MS < 3000ms, ancienne valeur)', () => {
  const match = splashSource.match(/SPLASH_DURATION_MS\s*=\s*(\d+)/);
  assert.ok(match, 'SPLASH_DURATION_MS doit rester une constante numerique simple');
  const duration = Number(match![1]);
  assert.ok(duration < 3000, `attendu < 3000ms (ancienne duree), trouve ${duration}`);
  assert.ok(duration >= 1500, `une duree trop courte (${duration}ms) ne laisserait plus le temps au prefetch/warmup`);
});
