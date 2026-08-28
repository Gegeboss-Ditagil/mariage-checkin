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

test('le plan de salle couvre exactement les tables 1 a 41 (reserve incluse)', () => {
  const positions = parsePositions(source);
  // Mise a jour du 23/08/2026 : la table 41 (reserve) a desormais une
  // position confirmee par Gersom -- avant cette date elle etait
  // volontairement absente (emplacement physique non defini).
  assert.equal(positions.size, 41, 'doit y avoir exactement 41 tables positionnees sur le plan');
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
  assert.match(source, /label: 'Cuisine', staffTag: 'Traiteur'/);
  assert.match(source, /label: 'Bar', staffTag: 'Bar'/);
  assert.match(source, /vertical: true, staffTag: 'DJ_Animation'/);
  assert.match(source, /staffTag: 'Photographe'/);
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
  // plein `border-ink bg-ink text-white`) plutot qu'un simple contour.
  assert.match(pageSource, /setCoteFiltre\(\(c\) => \(c === 'Nelly' \? 'toutes' : 'Nelly'\)\)/);
  assert.match(pageSource, /setCoteFiltre\(\(c\) => \(c === 'Gege' \? 'toutes' : 'Gege'\)\)/);
  assert.match(pageSource, /setFiltre\(\(f\) => \(f === 'confirmee' \? 'toutes' : 'confirmee'\)\)/);
  assert.match(pageSource, /setFiltre\(\(f\) => \(f === 'provisoire' \? 'toutes' : 'provisoire'\)\)/);
  assert.match(pageSource, /border-ink bg-ink text-white/);
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
