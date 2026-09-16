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
  assert.match(source, />\s*Vide\s*<\/text>/);
});

// v1.53.10, retour de Gersom (photo seatplan.io en reference) : "ce n'est
// pas facile [a lire]... et en plus tu fais des erreurs... s'ils sont
// plutot affiches en perpendiculaire et que c'est justement juste le cote
// court du rectangle qui touche la tangente du cercle" -- l'etiquette
// devient etroite (cote court tangent) et longue (cote long radial), au
// lieu de l'ancienne pastille large (cote long tangent, v1.48.2-v1.53.3).
test("l'etiquette de siege a le cote court tangent au cercle et le cote long radial (SEAT_WIDTH < SEAT_HEIGHT), inverse de l'ancienne pastille large", () => {
  assert.match(source, /SEAT_WIDTH = 46/);
  assert.match(source, /SEAT_HEIGHT = 64/);
});

// "Aussi la logique de comment il raccourcit les noms" -- seatplan.io
// tronque le prenom (avec "...") sur la premiere ligne et garde le reste du
// nom sur la seconde ligne, empilees radialement. Purement un habillage
// d'affichage : le nom complet reste utilise tel quel par
// namesMatch/findSeatIndexByName (jamais tronque pour la correspondance).
test('splitSeatLabel scinde un nom en deux lignes (prenom tronque avec ellipse si trop long, reste du nom en dessous), un seul mot restant sur une seule ligne', () => {
  assert.match(source, /function splitSeatLabel\(name: string\): \[string, string \| null\] \{/);
  assert.match(source, /const MAX_LINE_CHARS = 8;/);
  assert.match(source, /function truncateLine\(s: string\): string \{\s*\n\s*return s\.length > MAX_LINE_CHARS \? s\.slice\(0, MAX_LINE_CHARS\) \+ '…' : s;/);
  assert.match(source, /if \(words\.length <= 1\) return \[truncateLine\(words\[0\] \|\| name\), null\];/);
  assert.match(source, /return \[truncateLine\(words\[0\]\), truncateLine\(words\.slice\(1\)\.join\(' '\)\)\];/);
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
  assert.match(pageSource, /onSelectSeat=\{\(idx\) => \{\s*\n\s*const isDeselect = /);
  // v1.48.8 : un tap direct sur un siege (pas via un nom de la liste) doit
  // desormais aussi effacer selectedInvitationId quand on deselectionne,
  // sinon une ligne resterait surlignee alors qu'elle ne correspond plus au
  // siege affiche en bas.
  assert.match(pageSource, /if \(isDeselect\) \{\s*\n\s*setSelectedInvitationId\(null\);\s*\n\s*return;\s*\n\s*\}/);
  // v1.48.9, retour de Gersom : "vice versa" -- un tap sur un siege NON
  // deselectionne retrouve desormais aussi l'invitation correspondante
  // (jamais approchee) parmi celles deja listees pour cette table.
  assert.match(pageSource, /namesMatch\(inv\.nom_affichage, seatName\)/);
  assert.match(pageSource, /extractMembresComplet\(inv\.notes\)\.some\(\(m\) => namesMatch\(m, seatName\)\)/);
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
  assert.match(panelSource, /import \{ TABLE_SEAT_NAMES, findSeatIndexByName, namesMatch \} from '@\/lib\/floorPlanSeats'/);
  assert.match(panelSource, /<TableSeatWheel/);
  // La table vient de la vraie source de placement (prop tableNumber, issue
  // de invitations.table_id -> tables.number), jamais devinee par nom.
  assert.match(panelSource, /tableNumber: number \| null;/);
  assert.match(panelSource, /const seatIndex = tableNumber !== null \? findSeatIndexByName\(tableNumber, guest\.nom_affichage\) : null;/);
});

// v1.48.9, retour de Gersom : "vice versa -- si j'appuie sur la chaise de la
// personne en dessous, ça me surligne directement dans cette page parmi les
// invités... c'est qui" -- reverse du 📍 (nom -> siege) deja existant.
test('GuestArrivalPanel surligne aussi la ligne du membre retrouve quand on touche un siege (vice versa)', () => {
  const panelSource = readFileSync(new URL('../components/GuestArrivalPanel.tsx', import.meta.url), 'utf8');
  assert.match(panelSource, /const \[highlightedGuestId, setHighlightedGuestId\] = useState<string \| null>\(null\);/);
  assert.match(panelSource, /guest\.id === highlightedGuestId/);
  assert.match(panelSource, /const match = seatName \? members\.find\(\(guest\) => namesMatch\(guest\.nom_affichage, seatName\)\) : undefined;/);
  assert.match(panelSource, /setHighlightedGuestId\(match \? match\.id : null\);/);
  // Reinitialise partout ou highlightedSeats l'est deja (changement
  // d'invitation), sinon une ligne resterait surlignee pour un autre groupe.
  assert.match(panelSource, /setHighlightedSeats\(\[\]\);\s*\n\s*setHighlightedGuestId\(null\);/);
});

// v1.48.8, retour de Gersom : "quand j'appuie sur Jonas, j'aimerais aussi que
// son nom en haut dans la fiche soit surligne" -- la liste au-dessus du
// dessin ne montrait jusqu'ici aucun etat "selectionne" sur la ligne touchee,
// seul le siege en bas changeait. La ligne se surligne toujours (via
// selectedInvitationId, mis a jour par onSelectSeat), mais v1.53.15 (voir le
// test suivant) retire la capacite inverse -- toucher directement un nom
// n'a plus d'effet sur le surlignage, seul le siege le declenche desormais.
test("/plan-table surligne la ligne de l'invitation correspondant au siege touche", () => {
  assert.match(pageSource, /selectedInvitationId\?: string \| null;/);
  assert.match(pageSource, /setSelectedInvitationId\(match \? match\.id : null\);/);
  assert.match(pageSource, /inv\.id === selectedInvitationId \? '-mx-1\.5 bg-accent-tint px-1\.5 py-1 ring-1 ring-accent\/40' : ''/);
  // Reinitialise partout ou highlightedSeats l'est deja (changement de table/
  // zone/localisation), sinon une ligne resterait surlignee pour une autre table.
  const resets = pageSource.match(/setHighlightedSeats\(\[\]\);/g) || [];
  const idResets = pageSource.match(/setSelectedInvitationId\(null\);/g) || [];
  assert.ok(idResets.length >= resets.length, 'selectedInvitationId doit etre reinitialise partout ou highlightedSeats l\'est');
});

// v1.53.15, retour de Gersom (capture d'écran de /plan-table, table 3) :
// "je suis coincé dans un mode select guest to see where is seated...
// comment entrer dans son invitation par la suite ?" -- v1.48.5 faisait
// toucher un nom surligner son siège au lieu de naviguer, sans issue directe
// vers /tables/[tableId] ensuite. Retire cette capacité (onSelectInvitation)
// : toucher un nom navigue de nouveau normalement, seul onSelectSeat (siège
// -> nom) surligne encore une ligne.
test("toucher un nom dans la liste de la table sélectionnée navigue de nouveau vers /tables/[tableId] (onSelectInvitation retiré)", () => {
  assert.doesNotMatch(pageSource, /onSelectInvitation/);
  const cardBlock = pageSource.slice(pageSource.indexOf('function TableCard('));
  // La carte entiere (en-tete + liste) est de nouveau un seul <Link>, sans
  // branche conditionnelle selon un ancien onSelectInvitation.
  assert.match(cardBlock, /<Link href=\{'\/tables\/' \+ table\.id\} className="block">/);
  assert.match(cardBlock, /\{invitationsList\}\s*\n\s*<\/Link>/);
});

// v1.48.8, retour de Gersom (photo "Table 1 — Maquela do Zombo") : la fiche
// d'une table (contrairement a /plan-table et /checkin/[invitationId])
// n'affichait encore aucun dessin de plan -- "en dessous des noms, on
// puisse aussi afficher la table... garder la meme logique... savoir où est-
// ce que la personne est assise". Meme mecanisme reutilise sur les deux
// routes de fiche de table (nouvelle et historique), jamais une nouvelle
// implementation.
// v1.51.0, retour de Gersom : le seul bouton 📍 par ligne (v1.48.8) devient
// TROIS icones distinctes -- "tu as trois icones : la pin, c'est pour aller
// voir où est-ce que la table est dans la salle... chaise, c'est pour que la
// table apparaisse en bas avec les chaises... check-in, ça passe à la
// prochaine page" : 📍 localise la table sur /plan-table (nouveau), 🪑
// reprend exactement l'ancien comportement de 📍 (surligner le siege), ✅
// ouvre explicitement /checkin/[invitationId] (en plus du tap sur le nom,
// deja existant, jamais remplace).
for (const route of ['../app/tables/[tableId]/page.tsx', '../app/table/[tableId]/page.tsx']) {
  test(`${route} affiche aussi le dessin "vu sur le plan photographie" sous la liste, avec trois icones (📍/🪑/✅) par invitation`, () => {
    const tableDetailSource = readFileSync(new URL(route, import.meta.url), 'utf8');
    assert.match(tableDetailSource, /import \{ TABLE_SEAT_NAMES, findSeatIndexByName, namesMatch \} from '@\/lib\/floorPlanSeats'/);
    assert.match(tableDetailSource, /import \{ TableSeatWheel \} from '@\/components\/TableSeatWheel'/);
    assert.match(tableDetailSource, /import \{ FLOOR_PLAN_TABLE_POSITIONS \} from '@\/components\/FloorPlan'/);
    assert.match(tableDetailSource, /<TableSeatWheel/);
    assert.match(tableDetailSource, /table && TABLE_SEAT_NAMES\[table\.number\]/);
    // Correspondance exacte uniquement (nom affiche + membres detailles),
    // jamais approchee -- meme regle que /plan-table et GuestArrivalPanel.
    assert.match(tableDetailSource, /\[inv\.nom_affichage, \.\.\.extractMembresComplet\(inv\.notes\)\]/);
    assert.match(tableDetailSource, /findSeatIndexByName\(table!\.number, name\)/);
    // 📍 : localise la table sur /plan-table (nouveau comportement), gate
    // sur la meme condition que le bouton "localiser" de /plan-table.
    assert.match(tableDetailSource, /const tableHasPlanPosition = !!table && table\.number in FLOOR_PLAN_TABLE_POSITIONS;/);
    assert.match(tableDetailSource, /router\.push\('\/plan-table\?table=' \+ table!\.number\)/);
    assert.match(tableDetailSource, />\s*\n\s*📍\s*\n/);
    // 🪑 : reprend l'ancien comportement du seul bouton 📍 (surligner le
    // siege + defiler), element separe du tap sur le nom (check-in).
    assert.match(tableDetailSource, />\s*\n\s*🪑\s*\n/);
    // ✅ : navigation explicite vers le check-in, en plus du tap existant
    // sur le nom (jamais un remplacement).
    assert.match(tableDetailSource, />\s*\n\s*✅\s*\n/);
    assert.match(tableDetailSource, /router\.push\('\/checkin\/' \+ inv\.id\)/);
    // Reinitialise au changement de tableId, comme highlightedSeats.
    assert.match(tableDetailSource, /setHighlightedSeats\(\[\]\);\s*\n\s*setSelectedInvitationId\(null\);/);
    // v1.48.9, retour de Gersom : "vice versa" -- toucher un siege sur le
    // dessin retrouve aussi l'invitation correspondante parmi celles de
    // cette table (jamais une recherche approchee).
    assert.match(tableDetailSource, /namesMatch\(inv\.nom_affichage, seatName\)/);
    assert.match(tableDetailSource, /extractMembresComplet\(inv\.notes\)\.some\(\(m\) => namesMatch\(m, seatName\)\)/);
  });
}

// v1.53.3, retour de Gersom (capture d'écran "Table 1") : "le bouton où c'est
// écrit non arrivé... ça prend trop d'espace sur la ligne" -- StatusBadge
// gagne une variante `compact` (point coloré, sans texte) utilisée
// uniquement ici (où la ligne cumule déjà nom + compteur + jusqu'à quatre
// icônes), inchangée ailleurs (/search, /staff, /dashboard/liste, qui ont
// chacun leur propre ligne, aucun problème d'espace signalé). "Quand je
// clique sur [le nom], ça devrait faire highlight [le siège]" -- toucher la
// ligne met désormais en évidence le siège au lieu de naviguer, devenu
// redondant depuis le bouton ✅ dédié (v1.51.0) ; sans correspondance de
// siège, la ligne continue de naviguer comme avant.
for (const route of ['../app/tables/[tableId]/page.tsx', '../app/table/[tableId]/page.tsx']) {
  test(`${route} : badge de statut compact (point coloré, sans texte) et tap sur la ligne met en évidence le siège au lieu de naviguer`, () => {
    const tableDetailSource = readFileSync(new URL(route, import.meta.url), 'utf8');
    assert.match(tableDetailSource, /<StatusBadge statut=\{inv\.statut\} compact \/>/);
    assert.match(tableDetailSource, /function highlightSeats\(\)/);
    assert.match(
      tableDetailSource,
      /onClick=\{\(\) => \(seatMatches\.length > 0 \? highlightSeats\(\) : router\.push\('\/checkin\/' \+ inv\.id\)\)\}/
    );
    // Le bouton 🪑 réutilise désormais la même fonction, plus de duplication.
    assert.match(tableDetailSource, /onClick=\{highlightSeats\}/);
  });
}

test('components/StatusBadge.tsx : la variante compact garde le libellé accessible (title/aria-label) sans jamais l\'afficher a l\'ecran', () => {
  const badgeSource = readFileSync(new URL('../components/StatusBadge.tsx', import.meta.url), 'utf8');
  assert.match(badgeSource, /compact\?: boolean;/);
  assert.match(badgeSource, /aria-label=\{STATUS_LABELS\[statut\]\}/);
  assert.match(badgeSource, /title=\{STATUS_LABELS\[statut\]\}/);
  // Le texte du statut ne doit jamais apparaitre dans le rendu compact --
  // seule la couleur (point) le distingue, c'est tout le point de la demande.
  const compactBlock = badgeSource.slice(badgeSource.indexOf('if (compact)'), badgeSource.indexOf('return (', badgeSource.indexOf('if (compact)') + 1));
  assert.doesNotMatch(compactBlock, /\{STATUS_LABELS\[statut\]\}<\/span>/);
});

test('/plan-table lit ?table=<numero> pour localiser une table venant de /tables/[tableId] ou /table/[tableId]', () => {
  const planTableSource = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');
  assert.match(planTableSource, /import \{ useSearchParams \} from 'next\/navigation'/);
  assert.match(planTableSource, /const searchParams = useSearchParams\(\);/);
  assert.match(planTableSource, /searchParams\.get\('table'\)/);
  assert.match(planTableSource, /locateOnPlan\(table\)/);
  // useSearchParams exige un boundary Suspense (comme les autres pages
  // dynamiques de l'app, ex. /tables/[tableId]).
  assert.match(planTableSource, /import \{ Suspense,/);
  assert.match(planTableSource, /<Suspense fallback=\{<div className="fixed inset-0 bg-bg" \/>\}>\s*\n\s*<PlanTablePageInner \/>/);
});

// v1.53.15, retour de Gersom : "retire ce texte" (les deux variantes du
// paragraphe d'instructions sous le dessin "vu sur le plan photographié",
// citées textuellement dans le message). Retiré des trois pages qui
// l'affichaient -- /plan-table, /tables/[tableId] et /table/[tableId]
// (GuestArrivalPanel l'avait déjà perdu en v1.53.11/v1.53.12, sur cette même
// fiche uniquement, pour une raison différente : "on connaît déjà le
// fonctionnement").
test('les paragraphes d\'instructions sous le dessin ont disparu de /plan-table, /tables/[tableId] et /table/[tableId]', () => {
  const tablesSource = readFileSync(new URL('../app/tables/[tableId]/page.tsx', import.meta.url), 'utf8');
  const tableSource = readFileSync(new URL('../app/table/[tableId]/page.tsx', import.meta.url), 'utf8');
  for (const src of [pageSource, tablesSource, tableSource]) {
    assert.doesNotMatch(src, /Touchez un nom/);
    assert.doesNotMatch(src, /Touchez 🪑/);
    assert.doesNotMatch(src, /ne reflète pas forcément la table actuelle/);
  }
});
