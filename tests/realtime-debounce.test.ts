import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Meme convention que tests/navigation-resilience.test.ts et
// tests/permissions.test.ts : composants/pages en JSX/TSX inspectes via
// readFileSync plutot qu'importes (le "type stripping" natif de Node ne
// transforme pas le JSX).
const debounceSource = readFileSync(new URL('../lib/debounce.ts', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const globalErrorSource = readFileSync(new URL('../app/global-error.tsx', import.meta.url), 'utf8');
const importPageSource = readFileSync(new URL('../app/admin/import-withjoy/page.tsx', import.meta.url), 'utf8');

test('les rechargements temps reel sont regroupes (debounce) pour encaisser une rafale d import CSV', () => {
  assert.match(debounceSource, /export function debounce/);

  // Les 7 ecrans qui rechargent TOUT leur etat sur un evenement Realtime --
  // /checkin/[invitationId] est volontairement absent : il applique la
  // mise a jour recue directement (payload.new), sans rechargement complet.
  const realtimePages = [
    '../app/dashboard/page.tsx',
    '../app/plan-table/page.tsx',
    '../app/table/[tableId]/page.tsx',
    '../app/tables/[tableId]/page.tsx',
    '../app/tables/move/[invitationId]/page.tsx',
    '../app/checkin/[invitationId]/members/page.tsx',
    '../app/exceptions/page.tsx',
  ];
  for (const rel of realtimePages) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
    assert.match(src, /from '@\/lib\/debounce'/, rel + ' doit importer debounce');
    assert.match(src, /debounce\(load, 400\)/, rel + ' doit debouncer son rechargement temps reel');
  }
});

test('le service worker ne repond jamais undefined meme si le cache offline est absent', () => {
  const navigateBlock = swSource.slice(swSource.indexOf("request.mode === 'navigate'"));
  assert.match(navigateBlock, /caches\s*\n?\s*\.match\('\/offline'\)/);
  assert.match(navigateBlock, /res \|\| Response\.error\(\)/);
});

test('un crash dans le layout racine reste rattrapable (filet global)', () => {
  assert.match(globalErrorSource, /^'use client';/m);
  assert.match(globalErrorSource, /<html lang="fr">/);
  assert.match(globalErrorSource, /<body/);
  assert.match(globalErrorSource, /export default function GlobalError/);
});

test('l import With Joy accepte plusieurs alias MIME pour rester utilisable depuis le selecteur de fichiers iOS', () => {
  assert.match(importPageSource, /accept="\.csv,text\/csv,text\/comma-separated-values/);
});
