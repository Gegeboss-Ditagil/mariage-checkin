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
const zoomSource = readFileSync(new URL('../components/ZoomableFloorPlan.tsx', import.meta.url), 'utf8');

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

test('le plan de salle couvre exactement les tables 1 a 41 (reserve = table 1, plus de 42)', () => {
  const positions = parsePositions(source);
  // v1.68.2 (06/10/2026) : bascule confirmee par Gersom de la reserve
  // 41->42 (migration 0062, inverse 0061) -- la table 42 redevient
  // l'unique reserve et retrouve donc une position sur le plan, la table 41
  // devient une table normale (garde la sienne).
  // v1.71.0 (migration 0064) : la table 1 « Maquela do Zombo » est la
  // reserve excedentaire, la table 42 est desactivee et n'est plus dessinee.
  assert.equal(positions.size, 41, 'doit y avoir exactement 41 tables positionnees sur le plan');
  assert.ok(!positions.has(42), 'la table 42 ne doit plus apparaitre sur le plan');
  for (let n = 1; n <= 41; n++) {
    assert.ok(positions.has(n), 'table ' + n + ' doit avoir une position sur le plan');
  }
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
  // v1.70.0 : viewBox aux proportions exactes du PDF seatplan.io (echelle
  // uniforme x2.2), remplace l'ancien 1750 x 1080 etire en largeur.
  // v1.71.0 : nouvel export Tabloid, echelle uniforme x1.5.
  assert.match(source, /viewBox="0 0 1220 950"/);
  const positions = parsePositions(source);
  for (const [number, [x, y]] of positions) {
    assert.ok(x >= 34 && x <= 1186, 'cible tactile de la table ' + number + ' hors du viewBox en x (' + x + ')');
    assert.ok(y >= 34 && y <= 916, 'cible tactile de la table ' + number + ' hors du viewBox en y (' + y + ')');
  }
});

// v1.70.0, retour de Gersom (PDF seatplan.io du 07/10/2026) : « il manque
// des détails surtout dans les à-côtés, on dirait une mauvaise
// reproduction... mets les sorties et autres comme dans ce plan. »
// Geometrie reprise du PDF (points PDF convertis par pdfToPlan).
const PDF_TO_PLAN = (x: number, y: number, w: number, h: number) => ({
  x: Math.round((x - 200) * 1.5),
  y: Math.round((y - 70) * 1.5),
  w: Math.round(w * 1.5),
  h: Math.round(h * 1.5),
});
function parseRooms(src: string) {
  const re = /room\(\[([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\], '((?:[^'\\]|\\.)*)'|room\(\[([\d.]+), ([\d.]+), ([\d.]+), ([\d.]+)\], "([^"]*)"/g;
  const rooms: { label: string; x: number; y: number; w: number; h: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const nums = (m[1] ? [m[1], m[2], m[3], m[4]] : [m[6], m[7], m[8], m[9]]).map(Number);
    rooms.push({ label: m[5] ?? m[10], ...PDF_TO_PLAN(nums[0], nums[1], nums[2], nums[3]) });
  }
  return rooms;
}

test('v1.71.0 : le plan reprend toutes les zones, noms et sorties du PDF seatplan.io', () => {
  assert.match(source, /const PLAN_ORIGIN_X = 200;/);
  assert.match(source, /const PLAN_ORIGIN_Y = 70;/);
  assert.match(source, /const PLAN_SCALE = 1\.5;/);
  const labels = parseRooms(source).map((r) => r.label);
  for (const expected of [
    'WC handicapés',
    'WC hommes',
    'WC femmes',
    'Bar soirée',
    'Les mariés',
    'DJ et animation',
    'Zone concert et show',
    'Piste de danse',
    'Espace orchestre',
    'Couloir Nord',
    'Allée centrale',
    'Long rideau blanc',
    'Couloir Est',
    'Section A',
    'Section B',
    'Section C',
    'Section D',
    "Vin d'honneur & buffet",
    'Couloir Sud',
    'Table vin d’honneur C',
    'Table vin d’honneur D',
    'Table vin d’honneur E',
    'Cloison temporaire A',
    'Sangria',
    'RP',
    'PO',
    'SO',
    'Les mariées',
  ]) {
    assert.ok(labels.includes(expected), 'zone manquante : ' + expected);
  }
  assert.ok(labels.some((l) => /^Cloison temporaire B/.test(l)), 'cloison B (chantier zone média)');
  assert.ok(labels.some((l) => /zone média-buffet/.test(l)), 'cloison séparation zone média-buffet');
  // Anciens noms remplaces par ceux du PDF (v1.71.0).
  for (const old of ['Extension piste', 'CO', 'Séparation temporaire', "Vin d'honneur", 'Bar']) {
    assert.ok(!labels.includes(old), 'ancien nom encore present : ' + old);
  }
  assert.ok(labels.some((l) => /^Buffet A/.test(l)) && labels.some((l) => /^Buffet B/.test(l)));
  assert.ok(labels.some((l) => /sortie d.urgence/i.test(l)), 'barre « garder accès libre – sortie d’urgence »');
  // Portes et sorties ecrites sur le PDF.
  assert.equal((source.match(/marker\([^)]*'🚨', 'Sortie d’urgence', 'exit'/g) || []).length, 3, '3 sorties d’urgence');
  assert.match(source, /'🚪', 'Porte accès chapiteau', 'door'/);
  assert.match(source, /'🚪', 'Accès toilettes', 'door'/);
  // Zones absentes du PDF retirees.
  assert.doesNotMatch(source, /'Cuisine'/);
  assert.doesNotMatch(source, /'Zone enfants'/);
});

test('v1.70.0 : toutes les zones tiennent dans le viewBox et aucune table ne chevauche une zone', () => {
  const rooms = parseRooms(source);
  assert.ok(rooms.length >= 29);
  for (const r of rooms) {
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 1220 && r.y + r.h <= 950, 'zone hors viewBox : ' + r.label);
  }
  const positions = parsePositions(source);
  for (const [number, [x, y]] of positions) {
    for (const r of rooms) {
      // Cercle visible de la table (r=27) contre le rectangle de la zone.
      const nx = Math.max(r.x, Math.min(x, r.x + r.w));
      const ny = Math.max(r.y, Math.min(y, r.y + r.h));
      assert.ok(Math.hypot(x - nx, y - ny) > 27, 'la table ' + number + ' chevauche la zone ' + r.label);
    }
  }
});

test('v1.71.0 : la table 1 est la réserve, dessinée là où était la 42 et signalée « réserve »', () => {
  assert.doesNotMatch(source, /OFF_PLAN_TABLES|hors plan/);
  assert.match(source, /import \{ RESERVE_TABLE_NUMBER \} from '@\/lib\/withjoyImport';/);
  assert.match(source, /const isReserve = number === RESERVE_TABLE_NUMBER;/);
  assert.match(source, /strokeDasharray=\{isReserve && !selected \? '6 4' : undefined\}/);
  assert.match(source, /réserve\s*\n\s*<\/text>/);
  // Bas droite du bloc Sud (colonne 6, rangee 7), comme la 42 sur l'ancien PDF.
  assert.deepEqual(parsePositions(source).get(1), [792, 770]);
});

test('v1.71.0 : tables alignées sur une grille droite (6 colonnes x 8 rangées), allée entre les rangées 4 et 5', () => {
  const p = parsePositions(source);
  // Alignement « propre » demande par Gersom : 6 x et 8 y distincts seulement.
  const xs = new Set([...p.values()].map(([x]) => x));
  const ys = new Set([...p.values()].map(([, y]) => y));
  assert.deepEqual([...xs].sort((a, b) => a - b), [284, 385, 485, 585, 688, 792]);
  assert.deepEqual([...ys].sort((a, b) => a - b), [91, 193, 293, 396, 562, 666, 770, 882]);
  // Rangee du haut, de gauche a droite, comme sur le PDF.
  const top = [25, 24, 39, 14, 19, 17].map((n) => p.get(n)![0]);
  for (let i = 1; i < top.length; i++) assert.ok(top[i] > top[i - 1], 'ordre de la rangee du haut');
  // Toute table au nord de l'allee (y < 460), toute table au sud (y > 492).
  for (const n of [25, 24, 39, 14, 19, 17, 11, 3, 10, 18, 34, 37, 4, 12, 16, 22, 23, 5, 9, 21, 20, 35]) assert.ok(p.get(n)![1] < 460);
  for (const n of [2, 6, 13, 29, 40, 33, 32, 8, 28, 38, 30, 36, 7, 15, 1, 31, 41, 26, 27]) assert.ok(p.get(n)![1] > 492);
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

test('la table de reserve a desormais un bouton "localiser sur le plan"', () => {
  // Mise a jour du 23/08/2026 : la reserve (41) a maintenant une position
  // sur le plan (voir ci-dessus), donc reserve.map(...) doit recevoir
  // onLocate comme normales.map, garde par tablesSurLePlan.has(t.number).
  // Ancrage precis sur l'appel JSX (le fichier contient aussi
  // "reserve.map" plus haut, dans "new Set(reserve.map((t) => t.id))").
  const reserveBlock = pageSource.slice(pageSource.indexOf('{reserveVisibles.map((t) => ('));
  assert.match(reserveBlock.slice(0, reserveBlock.indexOf('/>')), /onLocate/);
});

test('les zones staff (Bar, Cuisine, DJ et animation, Prestataires) portent un tag deja present en base', () => {
  // Demande de Gersom le 23/08/2026 : cliquer une zone doit faire sortir le
  // personnel qui y est rattache -- reutilise les tags deja poses lors de
  // l'import CSV, aucune nouvelle liste de roles a maintenir.
  // v1.70.0 : la « Cuisine » n'existe pas sur le PDF seatplan.io -- le
  // traiteur est rattache aux deux Buffets (A et B), le photographe et les
  // autres prestataires a la « Table staff » du PDF.
  assert.match(source, /'Buffet B · tables zone Nord', 'orange', \{ labelSize: 11, staffTag: 'Traiteur' \}/);
  assert.match(source, /'Buffet A · tables zone Nord', 'orange', \{ labelSize: 11, staffTag: 'Traiteur' \}/);
  assert.match(source, /'Bar soirée', 'amber', \{ staffTag: 'Bar'/);
  assert.match(source, /vertical: true, staffTag: 'DJ_Animation'/);
  assert.match(source, /miniTable\(\[229, 313\.5, 20, 52\], 'Staff', 8, 'Photographe'\)/);
});

test('selectionner une table efface la zone selectionnee et inversement', () => {
  // Un seul panneau (table ou zone) affiche a la fois sous le plan.
  assert.match(pageSource, /setSelectedTableId\(table\.id\);\s*\n\s*setSelectedZone\(null\)/);
  assert.match(pageSource, /setSelectedZone\(room\);\s*\n\s*setSelectedTableId\(null\)/);
});

test('le personnel d une zone est filtre par tag sur les invitations deja chargees, sans nouvel appel reseau', () => {
  assert.match(pageSource, /inv\.category === 'Staff' && inv\.tags\.includes\(selectedZoneTag\)/);
});

test('la page utilise le plan zoomable, pas le plan brut directement', () => {
  // Demande de Gersom le 23/08/2026 : le plan est trop petit pour appeler
  // rapidement, ajout du pincement/zoom -- /plan-table doit passer par le
  // wrapper, sinon la fonctionnalite n'est pas branchee.
  assert.match(pageSource, /<ZoomableFloorPlan\b/);
  assert.doesNotMatch(pageSource, /<FloorPlan\b/);
});

test('le zoom du plan de salle reste borne et ne desactive pas le zoom natif de toute la page', () => {
  // MIN_SCALE=1 : on ne retrecit jamais en dessous de la taille normale.
  assert.match(zoomSource, /const MIN_SCALE = 1;/);
  assert.match(zoomSource, /const MAX_SCALE = 3;/);
  // touch-action: none doit rester scope au cadre du plan (pas au document
  // entier), pour ne pas casser le defilement/zoom du reste de l'appli.
  assert.match(zoomSource, /touchAction: 'none'/);
});

test('un pincement ou un glissement sur le plan ne declenche jamais la selection de la table relachee sous le doigt', () => {
  // Sans cette garde, relacher un pincement ou un glissement sur une table
  // la selectionnerait par accident au lieu de juste zoomer/deplacer.
  assert.match(zoomSource, /onClickCapture=\{onClickCapture\}/);
  assert.match(zoomSource, /moved\.current/);
  // Si le navigateur ne produit aucun click après le pincement, le prochain
  // vrai geste doit quand même pouvoir sélectionner une table.
  assert.match(zoomSource, /if \(pointers\.current\.size === 0\) moved\.current = false/);
  // Pas de division par zéro si les deux pointeurs démarrent au même pixel.
  assert.match(zoomSource, /Math\.max\(1, distance\(a, b\)\)/);
});

test('le plan regroupe recherche tris vol capacite et arrivees sans confondre les statuts', () => {
  assert.match(pageSource, /Rechercher table, ville, vol ou invité/);
  assert.match(pageSource, /Trier par numéro/);
  assert.match(pageSource, /Trier par places libres/);
  // v1.19.0 (28/08/2026) : "Placement prévu"/"Présence actuelle" (deux
  // barres separees) fusionnees en une seule barre "Placement & présence"
  // (CapacityBar) pour gagner de la place -- voir le test dedie plus bas.
  assert.match(pageSource, /Placement &amp; présence/);
  assert.match(pageSource, /Vol-/);
  assert.match(pageSource, /places prévues/);
  assert.match(pageSource, /arrivées/);
  assert.match(pageSource, /PLACEMENT_LABELS\[inv\.placement_status\]/);
  assert.match(pageSource, /inv\.statut === 'complet'/);
});

test('les filtres cote/placement vivent dans une rangee dediee, pas dans les tuiles de stats', () => {
  // v1.19.0 avait rendu les tuiles de stats elles-memes cliquables --
  // Gersom a signale le 28/08/2026, apres un vrai import CSV, que les
  // grosses tuiles ne montraient pas clairement laquelle etait active.
  // Retour a une rangee de pastilles dediee (comme l'ancienne "Toutes les
  // places / Confirmée / Provisoire"), etendue a Côté Nelly/Gégé, toujours
  // au meme endroit pres des boutons de tri, avec un etat actif net (fond
  // plein `border-accent bg-accent text-on-accent`) plutot qu'un simple contour.
  assert.match(pageSource, /setCoteFiltre\(\(c\) => \(c === 'Nelly' \? 'toutes' : 'Nelly'\)\)/);
  assert.match(pageSource, /setCoteFiltre\(\(c\) => \(c === 'Gege' \? 'toutes' : 'Gege'\)\)/);
  assert.match(pageSource, /setFiltre\(\(f\) => \(f === 'confirmee' \? 'toutes' : 'confirmee'\)\)/);
  assert.match(pageSource, /setFiltre\(\(f\) => \(f === 'provisoire' \? 'toutes' : 'provisoire'\)\)/);
  assert.match(pageSource, /border-accent bg-accent text-on-accent/);
  // Les tuiles de stats elles-memes ne sont plus des boutons.
  const tuilesBlock = pageSource.slice(pageSource.indexOf('{/* Stats compactes'), pageSource.indexOf('{/* Legende */}'));
  assert.doesNotMatch(tuilesBlock, /<button/);
});

test('les tuiles de stats refletent le filtre actif (tileStats), pas seulement les cartes de table', () => {
  // "ça élimine sur l'espèce de bouton en haut aussi" (Gersom, 28/08/2026) :
  // cliquer un filtre doit visiblement reduire les chiffres affiches dans
  // les tuiles du haut, pas seulement la liste des tables en dessous.
  assert.match(pageSource, /const tileStats = useMemo/);
  assert.match(pageSource, /\{tileStats\.totalPersonnes\}/);
  assert.match(pageSource, /\{tileStats\.parCote\.Nelly\}/);
  assert.match(pageSource, /\{tileStats\.parCote\.Gege\}/);
  assert.match(pageSource, /\{tileStats\.confirmees\}/);
  assert.match(pageSource, /\{tileStats\.provisoires\}/);
});

test('le filtre par cote (Nelly/Gege) est applique dans chaque table et sur la liste sans-table, jamais en masquant des tables entieres', () => {
  assert.match(pageSource, /type CoteFiltre = 'toutes' \| Cote;/);
  assert.match(pageSource, /coteFiltre === 'toutes' \|\| i\.cote === coteFiltre/);
  assert.match(pageSource, /coteFiltre === 'toutes' \|\| inv\.cote === coteFiltre/);
});

test('une seule barre de capacite (CapacityBar) remplace les deux barres separees, avec un depassement visible en rouge', () => {
  assert.match(pageSource, /function CapacityBar/);
  // Le composant est reutilise a la fois pour la carte de table (capacite
  // de la table) et pour le recapitulatif en haut de page (capacite
  // officielle) -- une seule implementation, pas deux copies.
  const capacityBarUsages = pageSource.match(/<CapacityBar\b/g) || [];
  assert.equal(capacityBarUsages.length, 2, 'CapacityBar doit etre utilise exactement 2 fois (carte de table + recapitulatif de page)');
  assert.match(pageSource, /const over = present > prevu;/);
});

// v1.70.0, constate en testant /plan-table dans Chrome : setPointerCapture
// systematique au pointerdown redirigeait pointerup ET click vers le <div>
// du zoom -- un clic souris (et Android) sur une table ou une zone staff ne
// declenchait jamais son onClick. Bug present depuis v1.11.0.
test('v1.70.0 : un simple tap sur le plan n est jamais capture par le conteneur de zoom', () => {
  const down = zoomSource.slice(zoomSource.indexOf('function onPointerDown'), zoomSource.indexOf('function onPointerMove'));
  // Aucune capture inconditionnelle a l'appui : seulement pour un 2e doigt.
  assert.doesNotMatch(down, /^\s*e\.currentTarget\.setPointerCapture\(e\.pointerId\);/m);
  assert.match(down, /if \(pointers\.current\.size === 2\) \{\s*\r?\n\s*for \(const id of pointers\.current\.keys\(\)\) capture\(e\.currentTarget, id\);/);
  assert.match(down, /if \(e\.isPrimary\) pointers\.current\.clear\(\);/);
  // Glissement une fois zoome : capture prise seulement apres le seuil de 4px.
  const move = zoomSource.slice(zoomSource.indexOf('function onPointerMove'), zoomSource.indexOf('function onPointerUp'));
  assert.match(move, /moved\.current = true;\s*\r?\n\s*capture\(e\.currentTarget, e\.pointerId\);/);
  assert.match(zoomSource, /function capture\(el: Element, pointerId: number\) \{/);
});
