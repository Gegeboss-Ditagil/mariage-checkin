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
  assert.match(pageSource, /highlightedIndices=\{highlightedSeats\}/);
  assert.match(pageSource, /onSelectSeat=\{\(idx\) =>\s*\n\s*setHighlightedSeats/);
});

// v1.48.5 : plusieurs sieges a la fois (toute une invitation surlignee
// depuis /plan-table, ou un seul siege depuis /checkin/[invitationId]) --
// voir lib/floorPlanSeats.ts (findSeatIndexByName) et
// components/GuestArrivalPanel.tsx pour le deuxieme usage.
test('TableSeatWheel accepte plusieurs sieges surlignes a la fois (highlightedIndices)', () => {
  assert.match(source, /highlightedIndices: number\[\]/);
  assert.match(source, /highlightedIndices\.includes\(idx\)/);
  assert.doesNotMatch(source, /highlightedIndex: number \| null/);
});

test('GuestArrivalPanel (fiche invite) rend aussi TableSeatWheel, retrouve par le numero de table reel', () => {
  const panelSource = readFileSync(new URL('../components/GuestArrivalPanel.tsx', import.meta.url), 'utf8');
  assert.match(panelSource, /import \{ TABLE_SEAT_NAMES, findSeatIndexByName \} from '@\/lib\/floorPlanSeats'/);
  assert.match(panelSource, /<TableSeatWheel/);
  // La table vient de la vraie source de placement (prop tableNumber, issue
  // de invitations.table_id -> tables.number), jamais devinee par nom.
  assert.match(panelSource, /tableNumber: number \| null;/);
  assert.match(panelSource, /const seatIndex = tableNumber !== null \? findSeatIndexByName\(tableNumber, guest\.nom_affichage\) : null;/);
});
