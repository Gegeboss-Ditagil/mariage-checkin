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
  const adminBlock = bottomNav.slice(bottomNav.indexOf('admin: ['), bottomNav.indexOf('};', bottomNav.indexOf('admin: [')));
  assert.match(adminBlock, /APPROVALS_ITEM,\s*\n\s*\],/);
  const directeurBlock = bottomNav.slice(bottomNav.indexOf('directeur: ['), bottomNav.indexOf('placeur:'));
  assert.match(directeurBlock, /APPROVALS_ITEM,\s*\n\s*\],/);
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

test('/approbations/[id]/assign presectionne automatiquement la meilleure table (priorite a celle du groupe arrive-avec, avant la table 41) sans empecher un choix manuel', () => {
  assert.match(assignPage, /const linkedTableId = request\?\.linked_invitation_table_id \|\| null;/);
  assert.match(assignPage, /if \(linkedTableId && usage\.table\.id === linkedTableId\) return 0;/);
  assert.match(assignPage, /if \(chosenTableId \|\| loading \|\| recommendations\.length === 0\) return;/);
  assert.match(assignPage, /setChosenTableId\(recommendations\[0\]\.table\.id\);/);
  assert.match(assignPage, /★ Arrivé\(e\) avec ce groupe/);
});
