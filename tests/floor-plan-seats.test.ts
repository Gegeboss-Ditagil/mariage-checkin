import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TABLE_SEAT_NAMES } from '../lib/floorPlanSeats.ts';

// v1.68.0 (05/10/2026) : noms de sieges lus par OCR sur les 4 photos de
// zones du plan de table FINAL seatplan.io (41 tables), pour la surbrillance
// optionnelle des chaises sur /plan-table -- explicitement laissee a
// discretion ("a toi de decider... tu pourras meme comparer avec les noms
// de With Joy pour te donner une idee"). PUREMENT INFORMATIF : ne doit
// jamais devenir une source de placement (celle-ci reste
// invitations.table_id, cf. docs/DATA_CHANGE_INSTRUCTIONS.md section 6).

test('TABLE_SEAT_NAMES couvre exactement les 41 tables, au moins dix sieges chacune', () => {
  const keys = Object.keys(TABLE_SEAT_NAMES).map(Number);
  assert.equal(keys.length, 41, 'doit couvrir exactement les 41 tables');
  for (let n = 1; n <= 41; n++) {
    assert.ok(TABLE_SEAT_NAMES[n], `table ${n} doit avoir une entree`);
    // Certaines tables comptent plus de 10 membres reels (ex. un invite
    // surprise approuve apres coup, un accompagnant non capture sur la
    // photo) -- ajoutes en fin de liste plutot que perdus, jamais tronques.
    assert.ok(TABLE_SEAT_NAMES[n].length >= 10, `table ${n} doit avoir au moins 10 sieges`);
  }
  assert.ok(!TABLE_SEAT_NAMES[42], 'la table 42 ne doit plus exister (decommissionnee, migration 0061)');
});

test('la table 41 (nouvelle reserve "excedentaire") est entierement vide sur la photo', () => {
  // Coherent avec le nouveau plan : aucune invitation n'y est placee, elle
  // sert de reserve (voir supabase/migrations/0061).
  assert.ok(TABLE_SEAT_NAMES[41].every((seat) => seat === null));
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

// v1.68.1 : reconstruction complete depuis le PDF seatplan.io final (export
// vectoriel, texte extrait directement via PyMuPDF -- pas une photo, voir
// CHANGELOG), remplacant les donnees v1.68.0 obtenues par OCR de 4 photos de
// zones. Les noms sont recoupes avec les membres reellement places en base
// (invitations.table_id, apres la mise a jour groupee de ce lot) pour
// reprendre l'orthographe canonique de l'application. Quelques verifications
// ponctuelles plutot qu'une couverture exhaustive (405 sieges, deja
// verifies un a un pendant la construction du fichier).
test('v1.68.1 : quelques sieges verifies correspondent aux vrais occupants de leur table (PDF final)', () => {
  assert.equal(TABLE_SEAT_NAMES[4][0], 'Henri Onatshungu Momba');
  assert.equal(TABLE_SEAT_NAMES[2][7], 'Maguy Malungu');
  assert.equal(TABLE_SEAT_NAMES[2][8], 'Ruben Kinanga Malungu');
  assert.equal(TABLE_SEAT_NAMES[32][2], 'Sister 2 Malungu');
  assert.equal(TABLE_SEAT_NAMES[32][3], 'Keziah Malungu');
  assert.equal(TABLE_SEAT_NAMES[7][0], 'Safira Tusevo');
  assert.equal(TABLE_SEAT_NAMES[1][3], 'Erika Dos Goncalves');
  // La famille Lukoki, absente de la base avant ce lot, est confirmee par le
  // PDF final comme reellement presente a la table 40 -- contrairement a la
  // v1.68.0 (OCR de photos), qui ne l'avait pas retrouvee en base et
  // l'excluait donc de l'affichage.
  assert.equal(TABLE_SEAT_NAMES[40][8], 'Dany Lukoki');
});
