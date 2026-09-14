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
  assert.match(pageSource, /onSelectSeat=\{\(idx\) => \{\s*\n\s*setHighlightedSeats/);
  // v1.48.8 : un tap direct sur un siege (pas via un nom de la liste) doit
  // desormais aussi effacer selectedInvitationId, sinon une ligne resterait
  // surlignee dans la liste au-dessus alors qu'elle ne correspond plus au
  // siege affiche en bas.
  assert.match(pageSource, /setSelectedInvitationId\(null\);\s*\n\s*\}\}/);
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

// v1.48.8, retour de Gersom : "quand j'appuie sur Jonas, j'aimerais aussi que
// son nom en haut dans la fiche soit surligne" -- la liste au-dessus du
// dessin ne montrait jusqu'ici aucun etat "selectionne" sur la ligne touchee,
// seul le siege en bas changeait.
test("/plan-table surligne aussi la ligne de l'invitation touchee dans la liste (pas seulement son siege)", () => {
  assert.match(pageSource, /selectedInvitationId\?: string \| null;/);
  assert.match(pageSource, /setSelectedInvitationId\(inv\.id\);/);
  assert.match(pageSource, /inv\.id === selectedInvitationId \? '-mx-1\.5 bg-accent-tint px-1\.5 py-1 ring-1 ring-accent\/40' : ''/);
  // Reinitialise partout ou highlightedSeats l'est deja (changement de table/
  // zone/localisation), sinon une ligne resterait surlignee pour une autre table.
  const resets = pageSource.match(/setHighlightedSeats\(\[\]\);/g) || [];
  const idResets = pageSource.match(/setSelectedInvitationId\(null\);/g) || [];
  assert.ok(idResets.length >= resets.length, 'selectedInvitationId doit etre reinitialise partout ou highlightedSeats l\'est');
});

// v1.48.8, retour de Gersom (photo "Table 1 — Maquela do Zombo") : la fiche
// d'une table (contrairement a /plan-table et /checkin/[invitationId])
// n'affichait encore aucun dessin de plan -- "en dessous des noms, on
// puisse aussi afficher la table... garder la meme logique... savoir où est-
// ce que la personne est assise". Meme mecanisme reutilise sur les deux
// routes de fiche de table (nouvelle et historique), jamais une nouvelle
// implementation : bouton 📍 par ligne (n'entre pas en conflit avec le tap
// sur le nom qui ouvre deja le check-in), jamais une source de placement.
for (const route of ['../app/tables/[tableId]/page.tsx', '../app/table/[tableId]/page.tsx']) {
  test(`${route} affiche aussi le dessin "vu sur le plan photographie" sous la liste, avec un bouton 📍 par invitation`, () => {
    const tableDetailSource = readFileSync(new URL(route, import.meta.url), 'utf8');
    assert.match(tableDetailSource, /import \{ TABLE_SEAT_NAMES, findSeatIndexByName \} from '@\/lib\/floorPlanSeats'/);
    assert.match(tableDetailSource, /import \{ TableSeatWheel \} from '@\/components\/TableSeatWheel'/);
    assert.match(tableDetailSource, /<TableSeatWheel/);
    assert.match(tableDetailSource, /table && TABLE_SEAT_NAMES\[table\.number\]/);
    // Correspondance exacte uniquement (nom affiche + membres detailles),
    // jamais approchee -- meme regle que /plan-table et GuestArrivalPanel.
    assert.match(tableDetailSource, /\[inv\.nom_affichage, \.\.\.extractMembresComplet\(inv\.notes\)\]/);
    assert.match(tableDetailSource, /findSeatIndexByName\(table!\.number, name\)/);
    // Le bouton 📍 est un element separe du bouton/lien qui ouvre le check-in
    // (jamais un remplacement de ce tap existant, contrairement a /plan-table
    // ou onSelectInvitation remplace la navigation).
    assert.match(tableDetailSource, />\s*\n\s*📍\s*\n/);
    assert.match(tableDetailSource, /router\.push\('\/checkin\/' \+ inv\.id\)/);
    // Reinitialise au changement de tableId, comme highlightedSeats.
    assert.match(tableDetailSource, /setHighlightedSeats\(\[\]\);\s*\n\s*setSelectedInvitationId\(null\);/);
  });
}
