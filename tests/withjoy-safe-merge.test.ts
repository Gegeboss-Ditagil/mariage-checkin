import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildImportPlan, parseCsvText } from '../lib/withjoyImport.ts';
import { buildSafeMergePlan, knownNamesOf, personKey, type ExistingInvitation, type TableLoad } from '../lib/withjoySafeMerge.ts';

// v1.71.0 -- « mise à jour sûre » pour un import With Joy de dernière minute
// (demande de Gersom). Ajoute seulement les personnes absentes ; ne supprime,
// ne déplace et ne remet rien à zéro.
function csv(rows: string[][]): string {
  return [
    ['party', 'first name', 'last name', 'phone number', 'email', 'rsvp', 'tags'],
    ...rows,
  ].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
}

const tables = (overrides: Record<number, number> = {}): TableLoad[] =>
  Array.from({ length: 41 }, (_, i) => ({ number: i + 1, capacity: 10, used: overrides[i + 1] ?? 0 }));

const existing: ExistingInvitation[] = [
  { id: 'a', nom_affichage: 'Rémy Landu', notes: 'RSVP: Oui', withjoy_party_id: 'p-remy', table_number: 30 },
  { id: 'b', nom_affichage: 'Famille Kimbau', notes: 'RSVP: Oui | Membres: Nadine Kimbau, Antoinette Kimbau, Cady Belida', withjoy_party_id: 'p-kimbau', table_number: 31 },
];

test('personKey ignore casse, accents, ponctuation et espaces', () => {
  assert.equal(personKey('  Rémy   LANDU '), 'remy landu');
  assert.equal(personKey('Jean-Claude Onokoko'), 'jean claude onokoko');
  assert.deepEqual(knownNamesOf(existing[1]), ['Famille Kimbau', 'Nadine Kimbau', 'Antoinette Kimbau', 'Cady Belida']);
});

test('une personne déjà en base (nom affiché OU membre listé) n est jamais rajoutée', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['p-remy', 'Remy', 'Landu', '', '', 'Oui', 'T030'],
    ['p-kimbau', 'Nadine', 'Kimbau', '', '', 'Oui', 'T031'],
    ['p-kimbau', 'Antoinette', 'Kimbau', '', '', 'Oui', 'T031'],
  ])));
  const merge = buildSafeMergePlan(plan, existing, tables());
  assert.equal(merge.additions.length, 0);
  assert.equal(merge.alreadyPresent, 2);
  assert.equal(merge.tableChanges.length, 0);
});

test('un nouvel invité est ajouté à la table de son tag quand elle a la place', () => {
  const plan = buildImportPlan(parseCsvText(csv([['p-new', 'Roger', 'Makongo', "'+33745986455", '', 'Oui', 'Côté_Gege,T030']])));
  const merge = buildSafeMergePlan(plan, existing, tables({ 30: 9 }));
  assert.equal(merge.additions.length, 1);
  assert.equal(merge.additions[0].tableNumber, 30);
  assert.equal(merge.additions[0].reason, 'tag');
  assert.equal(merge.addedPersons, 1);
});

test('table du tag pleine : le nouvel invité va dans la réserve (table 1), jamais au-delà de la capacité', () => {
  const plan = buildImportPlan(parseCsvText(csv([['p-new', 'Roger', 'Makongo', '', '', 'Oui', 'T030']])));
  const merge = buildSafeMergePlan(plan, existing, tables({ 30: 10 }));
  assert.equal(merge.additions[0].tableNumber, 1);
  assert.equal(merge.additions[0].reason, 'reserve');
  // Réserve pleine aussi : sans table plutôt que surcharger.
  const none = buildSafeMergePlan(plan, existing, tables({ 30: 10, 1: 10 }));
  assert.equal(none.additions[0].tableNumber, null);
  assert.equal(none.additions[0].reason, 'sans_table');
});

test('deux nouveaux invités ne peuvent pas prendre la même dernière place', () => {
  const plan = buildImportPlan(parseCsvText(csv([
    ['p1', 'Ana', 'Uno', '', '', 'Oui', 'T030'],
    ['p2', 'Bea', 'Dos', '', '', 'Oui', 'T030'],
  ])));
  const merge = buildSafeMergePlan(plan, existing, tables({ 30: 9 }));
  const byTable = merge.additions.map((a) => a.tableNumber).sort();
  assert.deepEqual(byTable, [1, 30]);
});

test('un changement de table d une personne existante est SIGNALÉ, jamais appliqué', () => {
  const plan = buildImportPlan(parseCsvText(csv([['p-remy', 'Rémy', 'Landu', '', '', 'Oui', 'T031']])));
  const merge = buildSafeMergePlan(plan, existing, tables());
  assert.equal(merge.additions.length, 0);
  assert.deepEqual(merge.tableChanges, [{ label: 'Rémy Landu', invitationName: 'Rémy Landu', fromTable: 30, toTable: 31 }]);
});

test('la table 42 désactivée (absente de la liste des tables actives) ne reçoit jamais personne', () => {
  const plan = buildImportPlan(parseCsvText(csv([['p-new', 'Zed', 'Nouveau', '', '', 'Oui', 'T041']])));
  const merge = buildSafeMergePlan(plan, existing, tables({ 41: 10, 1: 10 }));
  assert.equal(merge.additions[0].tableNumber, null);
});

test('route API : modes safe-apply (insertion seule, recalculée, anti-aperçu-périmé) et aucun delete', () => {
  const route = readFileSync(new URL('../app/api/admin/import-withjoy/route.ts', import.meta.url), 'utf8');
  const safeBlock = route.slice(route.indexOf("if (mode === 'safe-apply')"), route.indexOf("if (mode === 'preview')"));
  assert.match(safeBlock, /body\.expectedAdditions !== safe\.merge\.additions\.length/);
  assert.match(safeBlock, /from\('invitations'\)\.insert\(rows\)/);
  assert.match(safeBlock, /action: 'import_withjoy_safe_add'/);
  assert.doesNotMatch(safeBlock, /\.delete\(|admin_replace_invitations|nombre_arrive/);
  // La mise à jour sûre n'est PAS soumise au blocage live/terminé du
  // remplacement complet (elle est faite pour le jour J).
  assert.ok(route.indexOf("if (mode === 'safe-apply')") < route.indexOf("event.status !== 'setup'"));
  assert.match(route, /\.gt\('capacity', 0\)/);
});

test('page import : section « Mise à jour sûre » et remplacement complet masqué hors Préparation/Test', () => {
  const page = readFileSync(new URL('../app/admin/import-withjoy/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /Mise à jour sûre — recommandée le jour J/);
  assert.match(page, /mode: 'safe-apply', expectedAdditions: safe\.additions\.length/);
  assert.match(page, /const replaceAllowed = eventStatus === 'setup' \|\| eventStatus === 'test';/);
  assert.match(page, /\{!blocked && replaceAllowed && \(/);
});
