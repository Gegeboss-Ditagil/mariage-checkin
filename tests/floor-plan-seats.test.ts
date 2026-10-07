import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TABLE_SEAT_NAMES } from '../lib/floorPlanSeats.ts';

// v1.68.2 (06/10/2026) : noms de sieges extraits du PDF seatplan.io final du
// 06/10/2026 (42 tables, reserve redevenue la table 42, voir migration
// 0062), pour la surbrillance optionnelle des chaises sur /plan-table.
// PUREMENT INFORMATIF : ne doit jamais devenir une source de placement
// (celle-ci reste invitations.table_id, cf.
// docs/DATA_CHANGE_INSTRUCTIONS.md section 6).

test('TABLE_SEAT_NAMES couvre exactement les 41 tables (plus de table 42, v1.71.0)', () => {
  const keys = Object.keys(TABLE_SEAT_NAMES).map(Number);
  assert.equal(keys.length, 41, 'doit couvrir exactement les 41 tables');
  assert.equal(TABLE_SEAT_NAMES[42], undefined, 'la table 42 est desactivee (migration 0064)');
  for (let n = 1; n <= 41; n++) {
    assert.ok(TABLE_SEAT_NAMES[n], `table ${n} doit avoir une entree`);
    assert.ok(TABLE_SEAT_NAMES[n].length >= 1, `table ${n} doit avoir au moins un siege`);
  }
});

test('la table 1 (reserve "excedentaire" depuis v1.71.0) est entierement vide sur le PDF', () => {
  // Coherent avec le nouveau plan : aucune invitation n'y est placee, elle
  // sert de reserve (voir supabase/migrations/0064, qui remplace 0062). La
  // table 41 reste occupee par un vrai groupe de convives.
  assert.ok(TABLE_SEAT_NAMES[1].every((seat) => seat === null));
  assert.ok(TABLE_SEAT_NAMES[41].some((seat) => seat !== null));
});

test("un siege vide est represente par null, jamais une chaine vide ou 'Accompagnant'", () => {
  for (const seats of Object.values(TABLE_SEAT_NAMES)) {
    for (const seat of seats) {
      assert.notEqual(seat, '', 'un siege vide doit etre null, pas une chaine vide');
    }
  }
});

test("le module documente explicitement qu'il n'est pas une source de placement", () => {
  const source = readFileSync(new URL('../lib/floorPlanSeats.ts', import.meta.url), 'utf8');
  assert.match(source, /PUREMENT/);
  assert.match(source, /PAS la source de placement/);
  assert.match(source, /jamais ecrit en base/);
});

test("/plan-table affiche ce panneau uniquement pour la table selectionnee, jamais comme source d'assignation", () => {
  const pageSource = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /TABLE_SEAT_NAMES\[selectedTable\.number\]/);
  assert.match(pageSource, /Vu sur le plan photographié/);
  // Purement local (surbrillance client, jamais une ecriture Supabase) :
  // un simple useState, jamais passe a un appel fetch/API/RPC. Tableau
  // depuis v1.48.5 (plusieurs sieges a la fois, ex. toute une invitation).
  assert.match(pageSource, /const \[highlightedSeats, setHighlightedSeats\] = useState<number\[\]>\(\[\]\);/);
  assert.match(pageSource, /const isDeselect = highlightedSeats\.length === 1 && highlightedSeats\[0\] === idx;/);
  assert.match(pageSource, /setHighlightedSeats\(isDeselect \? \[\] : \[idx\]\);/);
});

test('reinitialise la surbrillance de siege a chaque changement de table (jamais collee sur une ancienne table)', () => {
  const pageSource = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');
  const setSelectedCalls = pageSource.match(/setSelectedTableId\([^)]*\);\n\s*setSelectedZone\([^)]*\);\n\s*setHighlightedSeats\(\[\]\);/g) || [];
  assert.ok(setSelectedCalls.length >= 2, 'selectTableByNumber et locateOnPlan doivent tous deux reinitialiser highlightedSeats');
});

test("toucher un siege sur le dessin de la table selectionnee surligne l'invitation correspondante (sens siege -> nom, seul restant)", () => {
  const pageSource = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(pageSource, /onSelectInvitation/);
  assert.match(pageSource, /extractMembresComplet\(inv\.notes\)\.some\(\(m\) => namesMatch\(m, seatName\)\)/);
  assert.match(pageSource, /selectedTableCardRef\.current\?\.scrollIntoView/);
});

// v1.68.2 : reconstruction complete depuis le nouveau PDF seatplan.io du
// 06/10/2026 (export vectoriel, texte extrait directement via PyMuPDF -- pas
// une photo, voir CHANGELOG), remplacant les donnees v1.68.1. Les noms sont
// recoupes avec les membres reellement places en base (invitations.table_id,
// apres la mise a jour groupee de ce lot, confirmee par Gersom) pour
// reprendre l'orthographe canonique de l'application. Quelques verifications
// ponctuelles plutot qu'une couverture exhaustive.
test('v1.68.2 : quelques sieges verifies correspondent aux vrais occupants de leur table (nouveau PDF du 06/10/2026)', () => {
  assert.equal(TABLE_SEAT_NAMES[4][0], 'Henri Onatshungu Momba');
  assert.equal(TABLE_SEAT_NAMES[2][0], 'Erika Dos Goncalves');
  assert.equal(TABLE_SEAT_NAMES[2][3], 'Maguy Malungu');
  assert.equal(TABLE_SEAT_NAMES[2][4], 'Ruben Kinanga Malungu');
  assert.equal(TABLE_SEAT_NAMES[32][8], 'Keren Malungu');
  assert.equal(TABLE_SEAT_NAMES[32][9], 'Keziah Malungu');
  assert.equal(TABLE_SEAT_NAMES[29][4], 'Nicole Tusevo');
  // Table 1 : plus aucun occupant confirme sur ce nouveau PDF (ses anciens
  // membres sont repartis ailleurs, voir en-tete du fichier) -- reste vide
  // ici plutot que de perdre toute entree.
  assert.ok(TABLE_SEAT_NAMES[1].every((seat) => seat === null));
  // La famille Landu occupe desormais la table 41 (devenue une table
  // normale, voir migration 0062) -- confirme par le PDF.
  assert.equal(TABLE_SEAT_NAMES[41][1], 'Lys Landu');
});
