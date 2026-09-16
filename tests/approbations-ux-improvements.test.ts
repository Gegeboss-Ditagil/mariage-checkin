import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Lot de corrections du 13/09/2026 (retour de Gersom, 6 photos) :
// 1. Approuver/Refuser ne faisait rien (contrainte `decided_via` en
//    production n'acceptait pas 'app' -- corrigé par migration, voir
//    supabase/migrations/0037_guest_approval_app_push.sql, déjà dans le
//    dépôt mais jamais appliquée en production avant ce jour).
// 2. Bottom nav : Approbations remplace Agenda/Staff en dernière position
//    pour admin/directeur (barre générique) et visibilite.
// 3. Flash de l'ancien compteur +/- dans GuestArrivalPanel en changeant
//    d'invitation.
// 4. Étiquette/bloc "Table N" cliquable vers la fiche de la table.
// 5. Caméra en direct dans l'app pour "📷 Invité surprise" (au lieu de
//    l'app Camera native).
// 6. "Arrivé(e) avec" (linked_invitation) affiché dans /approbations et
//    prioritaire dans /approbations/[id]/assign ; fiche resserrée.

const bottomNav = readFileSync(new URL('../components/BottomNav.tsx', import.meta.url), 'utf8');
const guestArrivalPanel = readFileSync(new URL('../components/GuestArrivalPanel.tsx', import.meta.url), 'utf8');
const checkinPage = readFileSync(new URL('../app/checkin/[invitationId]/page.tsx', import.meta.url), 'utf8');
const guestApprovalsRoute = readFileSync(new URL('../app/api/guest-approvals/route.ts', import.meta.url), 'utf8');
const approbationsPage = readFileSync(new URL('../app/approbations/page.tsx', import.meta.url), 'utf8');
const assignPage = readFileSync(new URL('../app/approbations/[id]/assign/page.tsx', import.meta.url), 'utf8');
const pushMigration = readFileSync(new URL('../supabase/migrations/0037_guest_approval_app_push.sql', import.meta.url), 'utf8');

test("migration 0037 (deja dans le depot) autorise bien 'app' dans decided_via -- verifie appliquee en production le 13/09/2026 (contrainte relevee manquante lors du diagnostic du bug 'la decision n'a pas pu etre enregistree')", () => {
  assert.match(pushMigration, /check \(decided_via in \('web', 'whatsapp', 'app'\)\)/);
});

test("bottom nav generique admin/directeur affiche Approbations (pas Agenda) en derniere position, Agenda restant sur /dashboard, /scan et /agenda", () => {
  // admin/directeur/placeur partagent desormais un seul litteral
  // (DIRECTOR_STYLE_ITEMS, deduplique le 14/09/2026) -- verifie qu'il se
  // termine bien par APPROVALS_ITEM et que les trois roles le referencent.
  const sharedBlock = bottomNav.slice(bottomNav.indexOf('const DIRECTOR_STYLE_ITEMS'), bottomNav.indexOf('const ITEMS'));
  assert.match(sharedBlock, /APPROVALS_ITEM\]/);
  assert.match(bottomNav, /admin: DIRECTOR_STYLE_ITEMS,/);
  assert.match(bottomNav, /directeur: DIRECTOR_STYLE_ITEMS,/);
  // Les branches isAdminDirector explicites (dashboard/scan/agenda) gardent
  // toutes AGENDA_ITEM -- seule la barre generique (autres pages) change.
  const dashboardBranch = bottomNav.slice(
    bottomNav.indexOf("pathname.startsWith('/dashboard')"),
    bottomNav.indexOf("pathname.startsWith('/agenda')")
  );
  assert.match(dashboardBranch, /AGENDA_ITEM/);
});

test("visibilite affiche Approbations (pas Staff) en derniere position", () => {
  const readOnlyBlock = bottomNav.slice(bottomNav.indexOf('const READ_ONLY_ITEMS'), bottomNav.indexOf('const ITEMS'));
  assert.match(readOnlyBlock, /APPROVALS_ITEM,\s*\n\];/);
  assert.doesNotMatch(readOnlyBlock, /href: ['"]\/staff['"]/);
});

test('GuestArrivalPanel reinitialise loading/initializing/members et previent le parent de facon optimiste des le changement d\'invitation, pour ne jamais laisser le compteur perime de l\'invitation precedente flasher', () => {
  const effectBlock = guestArrivalPanel.slice(
    guestArrivalPanel.indexOf("useEffect(() => {\n    let cancelled = false;"),
    guestArrivalPanel.indexOf('const supabase = createClient();\n    // La table')
  );
  assert.match(effectBlock, /setLoading\(true\);/);
  assert.match(effectBlock, /setInitializing\(false\);/);
  assert.match(effectBlock, /setMembers\(\[\]\);/);
  assert.match(effectBlock, /onVisibilityChange\?\.\(true\);/);
});

test('la fiche /checkin/[invitationId] rend le bloc "Table N" et l\'etiquette T0XX correspondante cliquables vers /tables/[tableId]', () => {
  assert.match(checkinPage, /onClick=\{\(\) => router\.push\('\/tables\/' \+ invitationTable\.id\)\}/);
  assert.match(checkinPage, /const isTableTag = \/\^T\\d\+\$\/i\.test\(tag\) && !!invitationTable;/);
  assert.match(checkinPage, /router\.push\('\/tables\/' \+ invitationTable!\.id\)/);
});

test("GET /api/guest-approvals joint l'invitation liee (nom + table) pour affichage 'arrive avec' cote approbateur", () => {
  assert.match(guestApprovalsRoute, /linked_invitation:linked_invitation_id\(nom_affichage, table_id, table:table_id\(number\)\)/);
  assert.match(guestApprovalsRoute, /linked_invitation_nom: row\.linked_invitation\?\.nom_affichage \?\? null/);
  assert.match(guestApprovalsRoute, /linked_invitation_table_id: row\.linked_invitation\?\.table_id \?\? null/);
  assert.match(guestApprovalsRoute, /linked_invitation_table_number: row\.linked_invitation\?\.table\?\.number \?\? null/);
});

test("la liste et la fiche detaillee de /approbations affichent 'Arrive(e) avec' quand une invitation est liee", () => {
  assert.match(approbationsPage, /linked_invitation_nom: string \| null;/);
  assert.match(approbationsPage, /Arrivé\(e\) avec \{r\.linked_invitation_nom\}/);
  assert.match(approbationsPage, /Arrivé\(e\) avec/);
  assert.match(approbationsPage, /selectedRequest\.linked_invitation_nom/);
});

test('la fiche detaillee de /approbations est resserree (photo 26dvh, marges reduites) pour tenir sans defiler', () => {
  assert.match(approbationsPage, /max-h-\[26dvh\]/);
  assert.doesNotMatch(approbationsPage, /max-h-\[42dvh\] w-full rounded-2xl bg-black/);
});

test('/approbations/[id]/assign presectionne automatiquement la meilleure table (priorite a celle du groupe arrive-avec, avant la table 42) sans empecher un choix manuel', () => {
  assert.match(assignPage, /const linkedTableId = request\?\.linked_invitation_table_id \|\| null;/);
  assert.match(assignPage, /if \(linkedTableId && usage\.table\.id === linkedTableId\) return 0;/);
  assert.match(assignPage, /if \(chosenTableId \|\| loading \|\| recommendations\.length === 0\) return;/);
  assert.match(assignPage, /setChosenTableId\(recommendations\[0\]\.table\.id\);/);
  assert.match(assignPage, /★ Arrivé\(e\) avec ce groupe/);
});

// Deuxieme lot (retour de Gersom, 5 photos, meme journee) :
// 7. Un refus peut etre reconsidere et approuve ensuite (jamais l'inverse).
// 8. Texte de /approbations/[id]/assign raccourci ("Automatique").
// 9. Swipe pour supprimer (admin uniquement) sur /approbations.
// 10. Flash residuel de GuestArrivalPanel (branche "ensure", pas "initialize").
// 11. Pincement casse sur /plan-table par le tire-pour-rafraichir.

const guestApprovalDecide = readFileSync(new URL('../lib/guestApprovalDecide.ts', import.meta.url), 'utf8');
const decideRoute = readFileSync(new URL('../app/api/guest-approvals/[id]/decide/route.ts', import.meta.url), 'utf8');
const deleteRoute = readFileSync(new URL('../app/api/guest-approvals/[id]/route.ts', import.meta.url), 'utf8');
const swipeableDeleteCard = readFileSync(new URL('../components/SwipeableDeleteCard.tsx', import.meta.url), 'utf8');
const planTablePage = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');

test("un refus peut etre reconsidere et approuve depuis l'application (jamais l'inverse, jamais depuis le lien public ou WhatsApp)", () => {
  assert.match(guestApprovalDecide, /allowReconsiderFromRefused = false/);
  assert.match(guestApprovalDecide, /allowReconsiderFromRefused && decision === 'approuve' \? \['en_attente', 'refuse'\] : \['en_attente'\]/);
  assert.match(guestApprovalDecide, /\.in\('statut', eligibleStatuts\)/);
  // Seule la route de decision depuis l'app passe true -- le lien public et
  // le webhook WhatsApp restent sur le comportement par defaut (false).
  assert.match(decideRoute, /applyGuestApprovalDecision\(createAdminClient\(\), \{ id: params\.id \}, body\.decision, 'app', user\.id, true\)/);
  assert.match(approbationsPage, /r\.statut === 'refuse' && role && hasCapability\(role, 'reviewGuestApproval'\)/);
  assert.match(approbationsPage, /selectedRequest\.statut === 'refuse' && role && hasCapability\(role, 'reviewGuestApproval'\)/);
});

// Troisieme lot (retour de Gersom le 13/09/2026, sur la fiche d'une demande
// reconsideree) : "je n'avais pas l'option de le mettre sur une table...
// le process a ete automatique" -- reconsiderer un refus doit permettre de
// choisir la table AVANT l'approbation, pas apres via le placement
// automatique (auto_assign_table_for_guest_approval, 0045).
const reconsiderAssignRoute = readFileSync(
  new URL('../app/api/guest-approvals/[id]/reconsider-assign/route.ts', import.meta.url),
  'utf8'
);
const reserveMigration = readFileSync(
  new URL('../supabase/migrations/0050_reserve_table_for_reconsidered_refusal.sql', import.meta.url),
  'utf8'
);

test("reconsiderer un refus mene d'abord au choix de table (/approbations/[id]/assign), plus a une approbation directe", () => {
  // Les deux boutons "Reconsidérer" (carte de liste + fiche détaillée)
  // sont désormais des liens vers l'écran de choix de table, pas des
  // appels directs à decide('approuve').
  assert.match(approbationsPage, /Reconsidérer → choisir une table/);
  assert.doesNotMatch(approbationsPage, /Reconsidérer → Approuver/);
  assert.match(
    approbationsPage,
    /r\.statut === 'refuse' && role && hasCapability\(role, 'reviewGuestApproval'\) && hasCapability\(role, 'assignGuestApproval'\)/
  );
  assert.match(
    approbationsPage,
    /selectedRequest\.statut === 'refuse' && role && hasCapability\(role, 'reviewGuestApproval'\) && hasCapability\(role, 'assignGuestApproval'\)/
  );
});

test("reserve_table_for_guest_approval (migration 0050) accepte desormais le statut 'refuse', pas seulement 'en_attente'", () => {
  assert.match(reserveMigration, /if v_req\.statut not in \('en_attente', 'refuse'\) then raise exception 'request_not_pending'; end if;/);
  assert.match(
    reserveMigration,
    /where reserved_table_id = p_table_id and statut in \('en_attente', 'refuse'\) and id <> p_request_id/
  );
});

test("/approbations/[id]/assign gagne un troisieme mode 'reconsider' pour une demande refusee, en plus de 'assign'/'reserve'", () => {
  assert.match(
    assignPage,
    /const mode: 'assign' \| 'reserve' \| 'reconsider' =\s*\n\s*request\?\.statut === 'en_attente' \? 'reserve' : request\?\.statut === 'refuse' \? 'reconsider' : 'assign';/
  );
  assert.match(
    assignPage,
    /!!found && !found\.table_id && \(found\.statut === 'approuve' \|\| found\.statut === 'en_attente' \|\| found\.statut === 'refuse'\)/
  );
  // Exige aussi reviewGuestApproval pour ce mode (il finit par decider),
  // en plus de assignGuestApproval deja verifie plus haut dans la page.
  assert.match(assignPage, /mode === 'reconsider' && role && !hasCapability\(role, 'reviewGuestApproval'\)/);
  assert.match(assignPage, /endpoint = *\n?\s*mode === 'reserve' \? '\/reserve-table' : mode === 'reconsider' \? '\/reconsider-assign' : '\/assign-table';/);
});

test("POST /api/guest-approvals/[id]/reconsider-assign reserve la table choisie PUIS approuve (allowReconsiderFromRefused), exige reviewGuestApproval ET assignGuestApproval", () => {
  assert.match(
    reconsiderAssignRoute,
    /!hasCapability\(user\.role, 'reviewGuestApproval'\) \|\| !hasCapability\(user\.role, 'assignGuestApproval'\)/
  );
  assert.match(reconsiderAssignRoute, /rpc\('reserve_table_for_guest_approval', \{ p_request_id: params\.id, p_table_id: tableId, p_agent_id: user\.id \}\)/);
  assert.match(
    reconsiderAssignRoute,
    /applyGuestApprovalDecision\(supabase, \{ id: params\.id \}, 'approuve', 'app', user\.id, true\)/
  );
  // Si la reservation echoue (table pleine entre-temps...), rien n'est
  // decide -- la demande reste refusee, l'agent choisit une autre table.
  assert.match(reconsiderAssignRoute, /if \(reserveError\) \{/);
});

test("le texte de /approbations/[id]/assign est raccourci en un badge Automatique/Sélectionnée plutôt qu'un paragraphe", () => {
  assert.match(assignPage, /chosenTableId === recommendations\[0\]\?\.table\.id \? 'Automatique' : 'Sélectionnée'/);
  assert.match(assignPage, /Touchez une autre table pour changer\./);
  assert.doesNotMatch(assignPage, /puis la table 41 \(excédentaire\), puis les autres tables de réserve/);
});

test('swipe pour supprimer une demande deja decidee, reserve a admin -- API DELETE refuse toute demande encore en_attente', () => {
  assert.match(approbationsPage, /import \{ SwipeableDeleteCard \} from '@\/components\/SwipeableDeleteCard'/);
  assert.match(approbationsPage, /enabled=\{role === 'admin' && r\.statut !== 'en_attente'\}/);
  assert.match(approbationsPage, /onDelete=\{\(\) => handleDelete\(r\.id\)\}/);
  assert.match(swipeableDeleteCard, /if \(!enabled\) return <>\{children\}<\/>;/);
  assert.match(swipeableDeleteCard, /DELETE_THRESHOLD = 120/);
  assert.match(deleteRoute, /export async function DELETE/);
  assert.match(deleteRoute, /hasCapability\(user\.role, 'adminPanel'\)/);
  assert.match(deleteRoute, /if \(existing\.statut === 'en_attente'\)/);
  assert.match(deleteRoute, /status: 409/);
  assert.match(deleteRoute, /guest_approval_deleted/);
});

// v1.53.2, bug reel signale par Gersom (16/09/2026, role admin confirme en
// base) : "je n'ai toujours pas la possibilite de swipe" -- premiere
// tentative (verrouillage d'axe : ne capturer le pointeur qu'une fois le
// geste tranche horizontal/vertical), confirmee INSUFFISANTE par un second
// test reel de Gersom (aucune reaction du tout au glissement, meme
// partielle). v1.53.4 corrige avec l'approche inverse, conforme a la
// specification touch-action/Pointer Events : capturer le pointeur
// IMMEDIATEMENT a onPointerDown (sans quoi WebKit/iOS ne delivre jamais de
// pointermove horizontal exploitable, le moteur natif tranchant seul et
// systematiquement pour un defilement vertical avec touch-action: pan-y) ;
// le defilement vertical natif reste possible malgre la capture (touch-action
// pan-y), et WebKit annule alors proprement la sequence (pointercancel),
// deja gere par onPointerCancel={onPointerUp}.
test('le pointeur est capture des onPointerDown (indispensable sur iOS pour recevoir des pointermove horizontaux exploitables), touch-action: pan-y et onPointerCancel laissent le defilement vertical natif fonctionner', () => {
  const onPointerDownBody = swipeableDeleteCard.slice(
    swipeableDeleteCard.indexOf('function onPointerDown'),
    swipeableDeleteCard.indexOf('function onPointerMove')
  );
  assert.match(onPointerDownBody, /\.setPointerCapture\(e\.pointerId\)/);
  assert.match(swipeableDeleteCard, /VERTICAL_INTENT_THRESHOLD = 10/);
  // Un mouvement a dominante verticale n'annule pas la capture (impossible a
  // "rendre" proprement au navigateur cote JS) : il arrete simplement de
  // suivre le geste en X, en comptant sur pointercancel pour reinitialiser
  // l'etat des que WebKit prend le relais du defilement natif.
  assert.match(swipeableDeleteCard, /if \(verticalIntent\.current\) return;/);
  assert.match(swipeableDeleteCard, /onPointerCancel=\{onPointerUp\}/);
  // Seul un geste sans intention verticale peut declencher la suppression au
  // relachement -- un simple tap ou un defilement vertical ne le peut plus.
  assert.match(swipeableDeleteCard, /!wasVerticalIntent && -dragX >= DELETE_THRESHOLD/);
});

test('GuestArrivalPanel : la branche "ensure" (backfill generique) marque aussi initializing=true avant son fetch, comme la branche "initialize" -- sinon settled devenait brievement vrai avec visible=false', () => {
  const ensureBlock = guestArrivalPanel.slice(
    guestArrivalPanel.indexOf('const expectedRows = Math.max'),
    guestArrivalPanel.indexOf('if (!cancelled) setInitializing(false);')
  );
  assert.match(ensureBlock, /setInitializing\(true\);\s*\n\s*await fetch\('\/api\/members\/ensure'/);
});

test('le tire-pour-rafraichir de /plan-table ignore les gestes a plusieurs doigts, pour ne plus entrer en conflit avec le pincement du plan de salle', () => {
  const touchStartBlock = planTablePage.slice(planTablePage.indexOf('function onTouchStart'), planTablePage.indexOf('function onTouchMove'));
  const touchMoveBlock = planTablePage.slice(planTablePage.indexOf('function onTouchMove'), planTablePage.indexOf('function onTouchEnd'));
  assert.match(touchStartBlock, /if \(e\.touches\.length > 1\)/);
  assert.match(touchMoveBlock, /if \(e\.touches\.length > 1\)/);
});

const permissionsSource = readFileSync(new URL('../lib/permissions.ts', import.meta.url), 'utf8');

test("agent_checkin gagne viewGuestApprovals en lecture seule (jamais reviewGuestApproval ni assignGuestApproval) -- Agenda et Approbations en derniers onglets, NextAgendaActivity reste aussi visible sur /scan", () => {
  assert.match(permissionsSource, /'viewAgenda', 'viewGuestApprovals',/);
  assert.match(permissionsSource, /if \(matchesPrefix\(pathname, '\/approbations'\) && !hasCapability\(role, 'viewGuestApprovals'\)\) return false;/);
  const agentBlock = bottomNav.slice(bottomNav.indexOf('const AGENT_CHECKIN_ITEMS'), bottomNav.indexOf('const READ_ONLY_ITEMS'));
  assert.match(agentBlock, /APPROVALS_ITEM/);
  // Depuis le 13/09/2026 (meme jour, second retour sur Agent001) : Agenda
  // est reintroduit comme onglet dedie (plus seulement via
  // NextAgendaActivity) -- voir le troisieme test de
  // navigation-resilience.test.ts sur ce meme bloc pour le detail complet.
  assert.match(agentBlock, /AGENDA_ITEM/);
  const nextAgendaActivity = readFileSync(new URL('../components/NextAgendaActivity.tsx', import.meta.url), 'utf8');
  assert.match(nextAgendaActivity, /hasCapability\(role, 'viewAgenda'\)/);
});
