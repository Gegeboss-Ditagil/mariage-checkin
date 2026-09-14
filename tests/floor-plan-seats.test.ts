import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { TABLE_SEAT_NAMES } from '../lib/floorPlanSeats.ts';

// v1.48.0 (14/09/2026) : noms de sieges lus par OCR sur les deux photos du
// plan de table transmises par Gersom (nouvelle configuration), pour la
// surbrillance optionnelle des chaises sur /plan-table -- explicitement
// laissee a discretion ("a toi de decider... tu pourras meme comparer avec
// les noms de With Joy pour te donner une idee"). PUREMENT INFORMATIF : ne
// doit jamais devenir une source de placement (celle-ci reste
// invitations.table_id, cf. docs/DATA_CHANGE_INSTRUCTIONS.md section 6).

test('TABLE_SEAT_NAMES couvre exactement les 42 tables, dix sieges chacune', () => {
  const keys = Object.keys(TABLE_SEAT_NAMES).map(Number);
  assert.equal(keys.length, 42, 'doit couvrir exactement les 42 tables');
  for (let n = 1; n <= 42; n++) {
    assert.ok(TABLE_SEAT_NAMES[n], `table ${n} doit avoir une entree`);
    assert.equal(TABLE_SEAT_NAMES[n].length, 10, `table ${n} doit avoir 10 sieges (vides ou nommes)`);
  }
});

test('la table 42 (Johannesburg, excedentaire) est entierement vide sur la photo', () => {
  // Coherent avec v1.47.0 : aucune invitation n'y etait encore placee au
  // moment de la photo, elle sert de reserve.
  assert.ok(TABLE_SEAT_NAMES[42].every((seat) => seat === null));
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

// v1.48.5, retour de Gersom : toucher une invitation dans la liste de la
// table selectionnee (au-dessus du dessin) surligne tous ses membres
// retrouves d'un coup, sans naviguer vers /tables/[tableId] -- "j'appuie
// vraiment sur la table, ça m'amène dans la prochaine page... [mais]
// j'appuie sur le nom, ça descend en bas".
test('toucher une invitation dans la liste de la table selectionnee surligne ses sieges au lieu de naviguer', () => {
  const pageSource = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /onSelectInvitation=\{\(inv\) => \{/);
  assert.match(pageSource, /const candidateNames = \[inv\.nom_affichage, \.\.\.extractMembresComplet\(inv\.notes\)\]/);
  assert.match(pageSource, /findSeatIndexByName\(selectedTable\.number, name\)/);
  assert.match(pageSource, /seatWheelRef\.current\?\.scrollIntoView/);
});
