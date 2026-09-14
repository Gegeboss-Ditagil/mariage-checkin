import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// TableSeatWheel.tsx melange JSX et TS : on ne peut pas l'importer directement
// dans un test node:test (le "type stripping" natif de Node ne transforme
// pas le JSX). Meme convention que les autres tests de ce dossier qui
// inspectent du code source via readFileSync plutot que de l'importer --
// voir tests/floor-plan.test.ts et tests/floor-plan-seats.test.ts.
//
// v1.48.2 (14/09/2026) : retour de Gersom sur les photos seatplan.io -- "je
// veux voir un dessin plutot de chaque table avec les places... juste une
// image de la table avec leurs differents noms et leurs sieges, et voir
// aussi les sieges vides" -- remplace l'ancienne grille de boutons par ce
// dessin circulaire.
const source = readFileSync(new URL('../components/TableSeatWheel.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');

test('TableSeatWheel exporte le composant attendu', () => {
  assert.match(source, /export function TableSeatWheel/);
});

test('les sieges rayonnent autour d\'un cercle central via une rotation SVG (pas une grille de boutons)', () => {
  assert.match(source, /rotate\(\$\{angle\}/);
  assert.match(source, /<circle/);
  // L'ancienne UI utilisait une grille CSS de boutons -- ne doit plus exister.
  assert.doesNotMatch(source, /grid grid-cols-2/);
  assert.doesNotMatch(source, /<button/);
});

test('un siege vide est visuellement distinct (trait pointille) et affiche "Vide"', () => {
  assert.match(source, /strokeDasharray=\{name \? undefined : '5 4'\}/);
  assert.match(source, /\{name \|\| 'Vide'\}/);
});

test('le siege selectionne est mis en evidence avec les couleurs accent', () => {
  assert.match(source, /highlighted \? 'fill-accent stroke-accent'/);
  assert.match(source, /highlighted \? 'fill-on-accent'/);
});

test('le composant est purement local : aucun appel reseau, aucune ecriture Supabase', () => {
  assert.doesNotMatch(source, /supabase/i);
  assert.doesNotMatch(source, /fetch\(/);
  assert.match(source, /PUREMENT INFORMATIF/);
  assert.match(source, /onSelectSeat.*index a\n\/\/ surligner localement|surligner localement/);
});

test('/plan-table rend TableSeatWheel a la place de la grille de boutons pour la table selectionnee', () => {
  assert.match(pageSource, /<TableSeatWheel/);
  assert.match(pageSource, /seats=\{TABLE_SEAT_NAMES\[selectedTable\.number\]\}/);
  assert.match(pageSource, /highlightedIndex=\{highlightedSeat\}/);
  assert.match(pageSource, /onSelectSeat=\{\(idx\) => setHighlightedSeat/);
});
