import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.53.15, retour de Gersom (capture d'écran de /plan-table, table 3) :
// "plein de orientations aussi. Quand on voit la table, on devrait
// comprendre où est le nord, est, sud... on va tout simplement mettre une
// flèche en direction de deux éléments. La piste de danse et les mariés. Et
// la ligne centrale. Comme ça, on comprend rapidement où est la table. Deux
// flèches, ça c'est [tout]." Deux petites flèches ajoutées au dessin "vu sur
// le plan photographié", calculées depuis la vraie position de chaque table
// sur components/FloorPlan.tsx -- purement un habillage d'orientation,
// jamais une donnée écrite en base ni une source de placement.
//
// lib/floorPlanOrientation.ts importe components/FloorPlan.tsx (.tsx, alias
// @/) : non exécutable tel quel par le chargeur TypeScript natif de Node
// (même contrainte que les autres fichiers .tsx de ce dépôt, voir
// tests/floor-plan.test.ts) -- vérifié par inspection de code, plus un
// calcul numérique de contrôle qui réimplémente ici la même formule que le
// fichier réel (vérifiée identique par regex ci-dessous) sur quelques
// tables dont la position est stable et documentée dans
// components/FloorPlan.tsx.

const floorPlanSource = readFileSync(new URL('../components/FloorPlan.tsx', import.meta.url), 'utf8');
const orientationSource = readFileSync(new URL('../lib/floorPlanOrientation.ts', import.meta.url), 'utf8');
const wheelSource = readFileSync(new URL('../components/TableSeatWheel.tsx', import.meta.url), 'utf8');

test('components/FloorPlan.tsx exporte les deux repères, dérivés des mêmes salles que celles dessinées (jamais une seconde source de coordonnées)', () => {
  assert.match(floorPlanSource, /const pisteDeDanseRoom = ROOMS\.find\(\(r\) => r\.label === 'Piste de danse'\)!;/);
  assert.match(floorPlanSource, /const lesMariesRoom = ROOMS\.find\(\(r\) => r\.label === 'Les mariés'\)!;/);
  assert.match(floorPlanSource, /const alleeCentraleRoom = ROOMS\.find\(\(r\) => r\.label === 'Allée centrale'\)!;/);
  assert.match(floorPlanSource, /export const DANCE_FLOOR_LANDMARK: \[number, number\] = \[\(pisteX \+ mariesX\) \/ 2, \(pisteY \+ mariesY\) \/ 2\];/);
  assert.match(floorPlanSource, /export const CENTRAL_AISLE_LANDMARK: \[number, number\] = centerOf\(alleeCentraleRoom\);/);
});

test('lib/floorPlanOrientation.ts calcule un angle sens horaire depuis le haut (même convention que TableSeatWheel), null pour une table sans position connue', () => {
  assert.match(orientationSource, /import \{ FLOOR_PLAN_TABLE_POSITIONS, DANCE_FLOOR_LANDMARK, CENTRAL_AISLE_LANDMARK \} from '@\/components\/FloorPlan';/);
  assert.match(orientationSource, /const radians = Math\.atan2\(dx, -dy\);/);
  assert.match(orientationSource, /if \(!position\) return null;/);
  assert.match(orientationSource, /danseAngle: angleToLandmark\(x, y, DANCE_FLOOR_LANDMARK\),/);
  assert.match(orientationSource, /alleeAngle: angleToLandmark\(x, y, CENTRAL_AISLE_LANDMARK\),/);
});

// Reimplementation locale de la MEME formule (verifiee identique ci-dessus
// par regex) pour un controle numerique independant, sur des reperes et
// positions de table stables et documentes dans components/FloorPlan.tsx :
// Piste de danse {370,425,240,250} + Les mariés {260,425,100,250} -> repere
// combiné (400,550) ; Allée centrale {610,425,420,90} -> (820,470) ; table 1
// [644,850] (zone sud, dernière rangée) ; table 22 [644,118] (zone nord,
// première rangée, coin nord-ouest) ; table 42 [996,118] ("Johannesburg").
function angleToLandmark(tableX: number, tableY: number, [lx, ly]: [number, number]): number {
  const dx = lx - tableX;
  const dy = ly - tableY;
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

test('contrôle numérique : les deux flèches pointent dans des directions cohérentes avec la position réelle de la table sur le plan', () => {
  const DANCE: [number, number] = [400, 550];
  const ALLEE: [number, number] = [820, 470];

  // Table 1, tout au sud du plan : les deux repères (au centre, plus au
  // nord) doivent être vus vers le nord -- angle proche de 0°/360°, jamais
  // proche de 180° (sud).
  const t1Dance = angleToLandmark(644, 850, DANCE);
  const t1Allee = angleToLandmark(644, 850, ALLEE);
  assert.ok(t1Dance > 270 || t1Dance < 90, `table 1 vers la piste/mariés devrait pointer au nord, obtenu ${t1Dance}°`);
  assert.ok(t1Allee > 270 || t1Allee < 90, `table 1 vers l'allée devrait pointer au nord, obtenu ${t1Allee}°`);

  // Table 22, coin nord-ouest : les deux repères sont au sud-est -- angle
  // dans le quadrant [90°, 270°].
  const t22Dance = angleToLandmark(644, 118, DANCE);
  const t22Allee = angleToLandmark(644, 118, ALLEE);
  assert.ok(t22Dance > 90 && t22Dance < 270, `table 22 vers la piste/mariés devrait pointer au sud, obtenu ${t22Dance}°`);
  assert.ok(t22Allee > 90 && t22Allee < 270, `table 22 vers l'allée devrait pointer au sud, obtenu ${t22Allee}°`);

  // Les deux flèches d'une même table ne pointent jamais exactement dans la
  // même direction (les deux repères sont à des endroits différents).
  assert.notEqual(Math.round(t1Dance), Math.round(t1Allee));
  assert.notEqual(Math.round(t22Dance), Math.round(t22Allee));
});

test('components/TableSeatWheel.tsx dessine les deux flèches hors de la zone des sièges, avec un viewBox élargi d\'autant', () => {
  assert.match(wheelSource, /export interface TableOrientation \{/);
  assert.match(wheelSource, /orientation\?: TableOrientation \| null;/);
  assert.match(wheelSource, /const ARROW_INNER_RADIUS = 146;/);
  assert.match(wheelSource, /const ARROW_OUTER_RADIUS = 162;/);
  // Les sieges occupent au maximum SEAT_RADIUS (110) + SEAT_HEIGHT/2 (32) =
  // 142 -- les fleches doivent commencer au-dela, jamais chevaucher un nom.
  assert.match(wheelSource, /const SEAT_RADIUS = 110;/);
  assert.match(wheelSource, /const SEAT_HEIGHT = 64;/);
  assert.match(wheelSource, /const viewMin = -VIEW_MARGIN;/);
  assert.match(wheelSource, /const viewSpan = VIEW_SIZE \+ VIEW_MARGIN \* 2;/);
  assert.match(wheelSource, /viewBox=\{`\$\{viewMin\} \$\{viewMin\} \$\{viewSpan\} \$\{viewSpan\}`\}/);
  // Le libelle reste hors du groupe pivote (place par trigonometrie), pour
  // rester lisible quel que soit l'angle plutot que de tourner avec la fleche.
  assert.match(wheelSource, /function OrientationArrow\(/);
  assert.match(wheelSource, /const labelX = CENTER \+ Math\.sin\(radians\) \* ARROW_LABEL_RADIUS;/);
  assert.match(wheelSource, /<OrientationArrow angle=\{orientation\.danseAngle\} label="💃"/);
  assert.match(wheelSource, /<OrientationArrow angle=\{orientation\.alleeAngle\} label="🚶"/);
});

test('les quatre écrans qui affichent le dessin passent orientation={getTableOrientation(...)}', () => {
  const sites = [
    { path: '../app/plan-table/page.tsx', arg: 'selectedTable.number' },
    { path: '../app/tables/[tableId]/page.tsx', arg: 'table.number' },
    { path: '../app/table/[tableId]/page.tsx', arg: 'table.number' },
    { path: '../components/GuestArrivalPanel.tsx', arg: 'tableNumber as number' },
  ];
  for (const { path, arg } of sites) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /import \{ getTableOrientation \} from '@\/lib\/floorPlanOrientation';/, path + ' doit importer getTableOrientation');
    const escapedArg = arg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('orientation=\\{getTableOrientation\\(' + escapedArg + '\\)\\}');
    assert.match(source, re, path + ' doit passer orientation={getTableOrientation(' + arg + ')}');
  }
});
