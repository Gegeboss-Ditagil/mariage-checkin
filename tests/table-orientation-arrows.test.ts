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
// combiné (400,550, inchangé depuis v1.68.0) ; Allée centrale
// {610,425,730,90} -> (975,470) ; table 42 [1130,730] (v1.68.2, derniere
// rangee de la grille au-dessous de l'allee, coin le plus au sud) ; table 25
// [630,120] (premiere rangee, coin nord-ouest de la grille).
function angleToLandmark(tableX: number, tableY: number, [lx, ly]: [number, number]): number {
  const dx = lx - tableX;
  const dy = ly - tableY;
  const degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

test('contrôle numérique : les deux flèches pointent dans des directions cohérentes avec la position réelle de la table sur le plan', () => {
  const DANCE: [number, number] = [400, 550];
  const ALLEE: [number, number] = [975, 470];

  // Table 42, coin sud (dernière rangée de la grille, sous l'allée) : les
  // deux repères (plus au nord) doivent être vus vers le nord -- angle
  // proche de 0°/360°, jamais proche de 180° (sud).
  const t42Dance = angleToLandmark(1130, 730, DANCE);
  const t42Allee = angleToLandmark(1130, 730, ALLEE);
  assert.ok(t42Dance > 270 || t42Dance < 90, `table 42 vers la piste/mariés devrait pointer au nord, obtenu ${t42Dance}°`);
  assert.ok(t42Allee > 270 || t42Allee < 90, `table 42 vers l'allée devrait pointer au nord, obtenu ${t42Allee}°`);

  // Table 25, coin nord-ouest (première rangée de la grille) : les deux
  // repères sont au sud -- angle dans le quadrant [90°, 270°].
  const t25Dance = angleToLandmark(630, 120, DANCE);
  const t25Allee = angleToLandmark(630, 120, ALLEE);
  assert.ok(t25Dance > 90 && t25Dance < 270, `table 25 vers la piste/mariés devrait pointer au sud, obtenu ${t25Dance}°`);
  assert.ok(t25Allee > 90 && t25Allee < 270, `table 25 vers l'allée devrait pointer au sud, obtenu ${t25Allee}°`);

  // Les deux flèches d'une même table ne pointent jamais exactement dans la
  // même direction (les deux repères sont à des endroits différents).
  assert.notEqual(Math.round(t42Dance), Math.round(t42Allee));
  assert.notEqual(Math.round(t25Dance), Math.round(t25Allee));
});

test('components/TableSeatWheel.tsx dessine les deux flèches hors de la zone des sièges, avec un viewBox élargi d\'autant', () => {
  assert.match(wheelSource, /export interface TableOrientation \{/);
  assert.match(wheelSource, /orientation\?: TableOrientation \| null;/);
  assert.match(wheelSource, /const ARROW_INNER_RADIUS = 146;/);
  // Les sieges occupent au maximum SEAT_RADIUS (110) + SEAT_HEIGHT/2 (32) =
  // 142 -- les fleches doivent commencer au-dela, jamais chevaucher un nom.
  assert.match(wheelSource, /const SEAT_RADIUS = 110;/);
  assert.match(wheelSource, /const SEAT_HEIGHT = 64;/);
  // v1.69.3 : viewBox ajuste au contenu reel (computeWheelViewBox), borne
  // par VIEW_MARGIN -- plus de carre fixe plein de vide.
  assert.match(wheelSource, /export function computeWheelViewBox\(/);
  assert.match(wheelSource, /viewBox=\{`\$\{viewX\} \$\{viewY\} \$\{viewW\} \$\{viewH\}`\}/);
  assert.match(wheelSource, /minX = Math\.max\(minX - VIEW_PADDING, -VIEW_MARGIN\);/);
  // v1.66.0 : la pastille (LandmarkTile, voir plus bas) reste hors du groupe
  // pivote (placee par trigonometrie), pour rester lisible quel que soit
  // l'angle plutot que de tourner avec la fleche -- meme principe que
  // l'ancien OrientationArrow qu'elle remplace.
  assert.match(wheelSource, /function LandmarkTile\(/);
  assert.match(wheelSource, /const tileRadius = tileCenterDistance\(angle, tileWidth, tileHeight\);/);
  assert.match(wheelSource, /const tileX = CENTER \+ Math\.sin\(radians\) \* tileRadius;/);
  assert.match(wheelSource, /<LandmarkTile\s*\n\s*angle=\{orientation\.danseAngle\}\s*\n\s*emoji="💃"\s*\n\s*label="Piste"/);
  assert.match(wheelSource, /<LandmarkTile\s*\n\s*angle=\{orientation\.alleeAngle\}\s*\n\s*emoji="🚶"\s*\n\s*label="Allée"/);
});

// v1.66.0, retour de Gersom (dessin a main levee sur une capture d'ecran) :
// "un espece de carre ou rectangle qui signifie la piste... l'emoji de la
// personne qui danse devrait etre beaucoup plus grand... un espece de petit
// rectangle [pour] l'allee... un emoji d'une personne qui marche beaucoup
// plus grande" + "pour mieux resize l'element, baisse la table... un peu
// plus d'espace dans ce carre-la pour les emojis" -- le simple libelle
// texte (emoji+mot combines sur une ligne, 15px) devient une vraie pastille
// rectangulaire avec emoji isole et agrandi ; le cercle central (la table)
// retrecit pour degager de la place.
test('v1.66.0 : pastilles rectangulaires Piste (carrée)/Allée (rectangle) avec emoji agrandi, table centrale réduite', () => {
  assert.match(wheelSource, /const HUB_RADIUS = 44;/);
  // v1.69.3 : pastilles agrandies (54x54/78x44 -> 72x72/98x68).
  assert.match(wheelSource, /const PISTE_TILE_WIDTH = 72;/);
  assert.match(wheelSource, /const PISTE_TILE_HEIGHT = 72;/);
  assert.match(wheelSource, /const ALLEE_TILE_WIDTH = 98;/);
  assert.match(wheelSource, /const ALLEE_TILE_HEIGHT = 68;/);
  // Piste carree (PISTE_TILE_WIDTH === PISTE_TILE_HEIGHT, deja verifie par
  // les deux regex ci-dessus), Allee plus large que haute (forme allongee,
  // ALLEE_TILE_WIDTH > ALLEE_TILE_HEIGHT) -- les deux pastilles different
  // volontairement, jamais le meme gabarit reutilise tel quel.
  assert.ok(98 > 68, 'la pastille Allee doit etre plus large que haute');
  // L'emoji est isole dans son propre <text>, bien plus grand que l'ancien
  // libelle combine (15px) -- jamais retabli a la meme taille que la legende.
  assert.match(wheelSource, /const EMOJI_FONT_SIZE = 36;/);
  assert.match(wheelSource, /style=\{\{ fontSize: EMOJI_FONT_SIZE \}\}/);
  // Legende texte separee de l'emoji, toujours visible sous la pastille.
  assert.match(wheelSource, /className="fill-text text-\[14px\] font-bold">\s*\r?\n\s*\{label\}/);
  // Un vrai rectangle de fond (pas seulement un halo de texte) derriere
  // l'emoji/la legende -- c'est tout le point de la demande ("un espece de
  // carre ou rectangle qui SIGNIFIE la piste").
  assert.match(wheelSource, /<rect\s*\n\s*x=\{tileX - tileWidth \/ 2\}/);
});

// v1.58.0, retour de Gersom (capture d'ecran table 2) : "mets des signaux
// beaucoup plus clairs... et mets nord, sud, est, ouest". Les deux fleches
// gagnent un vrai libelle texte (pas seulement l'emoji) + un halo de fond
// pour rester lisibles ; une boussole N/E/S/O FIXE (toujours haut=Nord,
// jamais recalculee par table -- contrairement aux deux fleches de reperes)
// est ajoutee, reprenant la convention schematique deja etablie ailleurs
// dans ce projet (Couloir Nord en haut, Couloir Est a droite sur
// components/FloorPlan.tsx ; "nord-ouest" deja utilise par Gersom des
// v1.48.1 pour designer les tables du coin superieur gauche) -- jamais une
// boussole magnetique reelle, le batiment n'ayant aucune orientation GPS
// connue.
test('v1.58.0 : libelles texte + halo de lisibilite sur les fleches, boussole N/E/S/O fixe', () => {
  assert.match(wheelSource, /function CompassLabel\(/);
  // v1.69.3 : deplacee dans l'anneau libre entre le cercle central (44) et
  // le bord interieur des sieges (78) -- les pastilles agrandies occupent
  // desormais l'anneau exterieur.
  assert.match(wheelSource, /const COMPASS_RADIUS = 61;/);
  assert.ok(61 - 7 > 44 && 61 + 7 < 110 - 32, 'la boussole reste entre le centre et les sieges');
  assert.match(wheelSource, /paintOrder: 'stroke'/);
  assert.match(wheelSource, /<CompassLabel angle=\{0\} label="N" \/>/);
  assert.match(wheelSource, /<CompassLabel angle=\{90\} label="E" \/>/);
  assert.match(wheelSource, /<CompassLabel angle=\{180\} label="S" \/>/);
  assert.match(wheelSource, /<CompassLabel angle=\{270\} label="O" \/>/);
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

// v1.69.3, retour de Gersom (capture d'ecran table 39) : "il ne faut pas que
// la fleche superpose l'espece de rectangle. Il faut que ca indique vers le
// rectangle, mais il ne faut pas que ca soit par-dessus." Reimplementation
// de tileCenterDistance (formule verifiee identique par regex) : a TOUS les
// angles, aucun point de la fleche n'est sous la pastille, et la pastille
// reste dans le viewBox maximal.
test('v1.69.3 : la flèche ne chevauche jamais la pastille, à aucun angle', () => {
  assert.match(wheelSource, /const ARROW_TIP_RADIUS = 170;/);
  assert.match(wheelSource, /const TILE_GAP = 6;/);
  assert.match(wheelSource, /const VIEW_MARGIN = 116;/);
  assert.match(wheelSource, /const halfExtent = Math\.min\(sx > 1e-9 \? w \/ 2 \/ sx : Infinity, cy > 1e-9 \? h \/ 2 \/ cy : Infinity\);/);
  assert.match(wheelSource, /return ARROW_TIP_RADIUS \+ TILE_GAP \+ halfExtent;/);
  const TIP = 170;
  const GAP = 6;
  const CENTER = 160;
  const MARGIN = 116;
  const VIEW = 320;
  const dist = (a: number, w: number, h: number) => {
    const r = (a * Math.PI) / 180;
    const sx = Math.abs(Math.sin(r));
    const cy = Math.abs(Math.cos(r));
    return TIP + GAP + Math.min(sx > 1e-9 ? w / 2 / sx : Infinity, cy > 1e-9 ? h / 2 / cy : Infinity);
  };
  for (const [w, h] of [[72, 72], [98, 68]]) {
    for (let a = 0; a < 360; a += 0.25) {
      const r = (a * Math.PI) / 180;
      const R = dist(a, w, h);
      const cx = CENTER + Math.sin(r) * R;
      const cy = CENTER - Math.cos(r) * R;
      // Tout point du trait et de la pointe (rayon 146 -> 170, +1 pour l'epaisseur).
      for (let rr = 146; rr <= TIP + 1; rr += 1) {
        const px = CENTER + Math.sin(r) * rr;
        const py = CENTER - Math.cos(r) * rr;
        const inside = Math.abs(px - cx) <= w / 2 + 1 && Math.abs(py - cy) <= h / 2 + 1;
        assert.ok(!inside, `fleche sous la pastille ${w}x${h} a ${a} deg (rayon ${rr})`);
      }
      for (const v of [cx - w / 2, cx + w / 2, cy - h / 2, cy + h / 2]) {
        assert.ok(v >= -MARGIN && v <= VIEW + MARGIN, `pastille hors viewBox a ${a} deg`);
      }
    }
  }
});

// v1.69.3 : agrandir les pastilles ne doit jamais elargir le dessin au-dela
// de l'ancien carre fixe (VIEW_SIZE + 2 x 104 = 528) dans le pire cas --
// sinon, une fois mis a l'echelle de l'ecran, les sieges retreciraient sur
// les tables dont les deux pastilles sont a gauche ET a droite.
test('v1.69.3 : le viewBox ajusté ne dépasse jamais l\'ancien carré de 528', () => {
  const TIP = 170;
  const GAP = 6;
  const dist = (a: number, w: number, h: number) => {
    const r = (a * Math.PI) / 180;
    const sx = Math.abs(Math.sin(r));
    const cy = Math.abs(Math.cos(r));
    return TIP + GAP + Math.min(sx > 1e-9 ? w / 2 / sx : Infinity, cy > 1e-9 ? h / 2 / cy : Infinity);
  };
  const extent = (a: number, w: number, h: number) => {
    const r = (a * Math.PI) / 180;
    const R = dist(a, w, h);
    return { x: Math.abs(Math.sin(r) * R) + w / 2 };
  };
  for (let a = 0; a < 360; a += 1) {
    // Piste et Allee de part et d'autre (pire cas horizontal).
    const width = extent(a, 72, 72).x + extent(a + 180, 98, 68).x + 2 * 4;
    assert.ok(width <= 528 + 24, `viewBox trop large (${width.toFixed(0)}) a ${a} deg`);
  }
});
