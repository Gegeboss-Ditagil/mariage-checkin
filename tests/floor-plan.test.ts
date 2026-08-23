import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// FloorPlan.tsx melange JSX et TS : on ne peut pas l'importer directement
// dans un test node:test (le "type stripping" natif de Node ne transforme
// pas le JSX). Meme convention que les autres tests de ce dossier qui
// inspectent du code source via readFileSync plutot que de l'importer --
// voir tests/permissions.test.ts et tests/members-migration.test.ts.
const source = readFileSync(new URL('../components/FloorPlan.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');

function parsePositions(src: string): Map<number, [number, number]> {
  const match = src.match(/FLOOR_PLAN_TABLE_POSITIONS[^{]*\{([\s\S]*?)\n\};/);
  assert.ok(match, 'FLOOR_PLAN_TABLE_POSITIONS introuvable dans FloorPlan.tsx');
  const body = match[1];
  const positions = new Map<number, [number, number]>();
  const entryRe = /(\d+):\s*\[(\d+),\s*(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(body))) {
    positions.set(Number(m[1]), [Number(m[2]), Number(m[3])]);
  }
  return positions;
}

test('le plan de salle couvre exactement les tables 1 a 40, sans la reserve (41)', () => {
  const positions = parsePositions(source);
  assert.equal(positions.size, 40, 'doit y avoir exactement 40 tables positionnees sur le plan');
  for (let n = 1; n <= 40; n++) {
    assert.ok(positions.has(n), 'table ' + n + ' doit avoir une position sur le plan');
  }
  // La reserve (41) n'a volontairement pas d'emplacement defini -- voir
  // Gersom le 23/08/2026 : a ajouter plus tard, jamais implicitement.
  assert.equal(positions.has(41), false, "la table 41 (reserve) ne doit pas apparaitre sur le plan pour l'instant");
});

test('les cibles tactiles des tables ne se chevauchent pas', () => {
  const positions = parsePositions(source);
  const entries = [...positions.entries()];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [numberA, [xA, yA]] = entries[i];
      const [numberB, [xB, yB]] = entries[j];
      const distance = Math.hypot(xA - xB, yA - yB);
      assert.ok(distance >= 68, 'les cibles des tables ' + numberA + ' et ' + numberB + ' se chevauchent');
    }
  }
});

test('toutes les coordonnees du plan restent dans le viewBox declare', () => {
  assert.match(source, /viewBox="0 0 1400 1080"/);
  const positions = parsePositions(source);
  for (const [number, [x, y]] of positions) {
    assert.ok(x >= 34 && x <= 1366, 'cible tactile de la table ' + number + ' hors du viewBox en x (' + x + ')');
    assert.ok(y >= 34 && y <= 1046, 'cible tactile de la table ' + number + ' hors du viewBox en y (' + y + ')');
  }
});

test('le plan de salle est replie par defaut, derriere un bouton dedie', () => {
  assert.match(pageSource, /const \[showFloorPlan, setShowFloorPlan\] = useState\(false\)/);
  assert.match(pageSource, /Voir le plan de salle/);
});

test('les tables du SVG sont utilisables au clavier', () => {
  assert.match(source, /role="button"/);
  assert.match(source, /tabIndex=\{0\}/);
  assert.match(source, /event\.key === 'Enter' \|\| event\.key === ' '/);
});

test('le bouton localiser n est jamais imbrique dans le lien de navigation', () => {
  const cardBlock = pageSource.slice(pageSource.indexOf('function TableCard'));
  assert.ok(cardBlock.indexOf('{onLocate && (') < cardBlock.indexOf("<Link href={'/tables/' + table.id}"));
});

test('la table de reserve n a pas de bouton "localiser sur le plan"', () => {
  // reserve.map(...) ne doit jamais recevoir onLocate -- seule normales.map
  // (tables 1-40) le fait, garde par tablesSurLePlan.has(t.number).
  const reserveBlock = pageSource.slice(pageSource.indexOf('reserve.map'));
  assert.doesNotMatch(reserveBlock.slice(0, reserveBlock.indexOf('/>')), /onLocate/);
});
