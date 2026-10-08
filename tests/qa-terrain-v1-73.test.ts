import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildInvitationSearchFilters, sanitizeSearchText, tableSearchText } from '../lib/searchFilters.ts';
import { decisionResultWithoutSecrets, withoutApprovalSecrets } from '../lib/guestApprovalPublic.ts';
import { computeTableCapacities } from '../lib/capacity.ts';
import type { InvitationRow, OverflowAssignmentRow, TableRow } from '../lib/types.ts';

// v1.73.0 -- QA terrain demandee par Gersom (08/10/2026) : vrais
// enregistrements sur l'invitation de Roger Makongo (table 30) avec un
// placeur (Agent001), un scanneur (Sanda) et un directeur (Tuzola), dans
// Chrome. Chaque test ci-dessous verrouille un defaut constate en vrai.

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('recherche : « MAKONGO roger » = chaque mot doit etre present, dans n importe quel ordre', () => {
  const filters = buildInvitationSearchFilters('nom', 'MAKONGO roger');
  assert.equal(filters.length, 2, 'un groupe .or() par mot (combines en ET)');
  assert.match(filters[0], /^nom_affichage\.ilike\.%MAKONGO%,groupe\.ilike\.%MAKONGO%,notes\.ilike\.%MAKONGO%,email\.ilike\.%MAKONGO%$/);
  assert.match(filters[1], /nom_affichage\.ilike\.%rog_r%/, 'e devient joker : Roger/Rogér');
});

test('recherche : accents sur e ignores (« Remy » trouve « Rémy »), jamais sur une saisie de 1-2 lettres', () => {
  assert.match(buildInvitationSearchFilters('nom', 'Remy')[0], /%R_my%/);
  assert.match(buildInvitationSearchFilters('nom', 'Hélène')[0], /%H_l_n_%/);
  assert.match(buildInvitationSearchFilters('nom', 'de')[0], /%de%/);
});

test('recherche : virgules, parentheses et jokers ne cassent plus le filtre PostgREST', () => {
  assert.equal(sanitizeSearchText('Alonso Isey (Godart)'), 'Alonso Isey Godart');
  assert.equal(sanitizeSearchText('Dupont, Jean'), 'Dupont Jean');
  assert.equal(sanitizeSearchText('%*"\\'), '');
  for (const group of buildInvitationSearchFilters('nom', 'Isey (Godart), x')) {
    assert.doesNotMatch(group.replace(/,(?=(nom_affichage|groupe|notes|email)\.)/g, ''), /[(),]/);
  }
  assert.deepEqual(buildInvitationSearchFilters('nom', ' ( ) '), []);
});

test('recherche : un numero (sans lettre, 5 chiffres ou plus) cherche le telephone, tous formats', () => {
  for (const q of ['07 45 98 64 55', '+33745986455', '0745986455', '745986455']) {
    assert.deepEqual(buildInvitationSearchFilters('nom', q), ['telephone_digits.ilike.%45986455%'], q);
    assert.deepEqual(buildInvitationSearchFilters('telephone', q), ['telephone_digits.ilike.%45986455%'], q);
  }
  assert.deepEqual(buildInvitationSearchFilters('telephone', '123'), []);
  assert.deepEqual(buildInvitationSearchFilters('email', 'roger @gmail.com'), ['email.ilike.%roger@gmail.com%']);
});

test('recherche : « table 30 » cherche la table 30 ; /search utilise ces filtres', () => {
  assert.equal(tableSearchText('Table 30'), '30');
  assert.equal(tableSearchText(' table  7 '), '7');
  assert.equal(tableSearchText('Londres'), 'londres');
  const page = read('app/search/page.tsx');
  assert.match(page, /buildInvitationSearchFilters\(mode, q\)/);
  assert.match(page, /for \(const group of filters\) request = request\.or\(group\)/);
  assert.match(page, /tableSearchText\(query\)/);
  assert.doesNotMatch(page, /'nom_affichage\.ilike\.%' \+ q/);
});

test('approbations : le jeton du lien public et le telephone ne quittent jamais le serveur', () => {
  const row = { id: 'r1', token: 'secret', approver_phone: '+33600000000', nom_invite: 'X', statut: 'en_attente' as const };
  const cleaned = withoutApprovalSecrets(row);
  assert.deepEqual(cleaned, { id: 'r1', nom_invite: 'X', statut: 'en_attente' });
  assert.ok(!('token' in decisionResultWithoutSecrets({ ok: true, request: row }).request!));
  assert.deepEqual(decisionResultWithoutSecrets({ ok: false, reason: 'not_found' } as { ok: false; reason: string; request?: undefined }), {
    ok: false,
    reason: 'not_found',
  });

  assert.match(read('app/api/guest-approvals/route.ts'), /request: \{ \.\.\.withoutApprovalSecrets\(created\), photo_signed_url: signedUrl \}/);
  assert.match(read('app/api/guest-approvals/[id]/reserve-table/route.ts'), /request: withoutApprovalSecrets\(data as GuestApprovalRequestRow\)/);
  for (const route of ['decide', 'reconsider-assign']) {
    const source = read('app/api/guest-approvals/[id]/' + route + '/route.ts');
    assert.match(source, /return NextResponse\.json\(decisionResultWithoutSecrets\(result\)\);/, route);
    assert.doesNotMatch(source, /return NextResponse\.json\(result\);/, route);
  }
});

test('bande /scan : memes invites attendus que le tableau de bord (invitations avec table seulement)', () => {
  const strip = read('components/ScanStatsStrip.tsx');
  assert.match(strip, /select\('nombre_prevu, nombre_arrive, table_id'\)/);
  assert.match(strip, /\.filter\(\s*\(i\) => i\.table_id !== null\s*\)/);
  assert.match(strip, /from\('tables'\)\.select\('capacity'\)\.gt\('capacity', 0\)/);
});

const table = (id: string, capacity = 10, is_reserve = false) => ({ id, number: 0, capacity, is_reserve }) as unknown as TableRow;
const inv = (id: string, table_id: string, prevu: number, arrive: number) =>
  ({ id, table_id, nombre_prevu: prevu, nombre_arrive: arrive, ne_viendra_pas: false }) as unknown as InvitationRow;
const overflow = (invitation_id: string, reserve_table_id: string, n: number) =>
  ({ id: 'o-' + invitation_id, invitation_id, reserve_table_id, nombre_personnes: n }) as unknown as OverflowAssignmentRow;

test('capacite : l excedent place en reserve n est plus compte aussi a la table d origine', () => {
  const tables = [table('t30'), table('t1', 10, true)];
  // Table 30 pleine (9 + Roger), Roger arrive a 2 : 1 personne placee en table 1.
  const invitations = [inv('autres', 't30', 9, 0), inv('roger', 't30', 1, 2)];
  const [t30, t1] = computeTableCapacities(tables, invitations, [overflow('roger', 't1', 1)]);
  assert.equal(t30.occupationEstimee, 10, 'table 30 : 10/10, pas 11/10');
  assert.equal(t30.arrivees, 1);
  assert.equal(t1.occupationEstimee, 1);
  assert.equal(t1.arrivees, 1);

  // Arrivee annulee apres le placement : la table d origine n est jamais
  // sous-comptee (la place de reserve devient un siege fantome signale sur la fiche).
  const [t30b] = computeTableCapacities(tables, [inv('autres', 't30', 9, 0), inv('roger', 't30', 1, 1)], [overflow('roger', 't1', 1)]);
  assert.equal(t30b.occupationEstimee, 10);
  assert.equal(t30b.arrivees, 1);
});

test('fiche check-in : l excedent deja place n est plus propose, une place de reserve inutile est signalee', () => {
  const page = read('app/checkin/[invitationId]/page.tsx');
  assert.match(page, /from\('overflow_assignments'\)\s*\.select\('id, nombre_personnes, reserve_table:reserve_table_id\(number\)'\)\s*\.eq\('invitation_id', requestedId\)/);
  assert.match(page, /table: 'overflow_assignments', filter: 'invitation_id=eq\.' \+ invitationId/);
  assert.match(page, /const restant = excedent - placed;/);
  assert.match(page, /\{restant > 0 && \(/);
  assert.match(page, /\{restant < 0 && \(/);
  assert.match(page, /Libérer la place en réserve/);
  assert.match(page, /canReorganizeExcedent \?/);
  assert.doesNotMatch(page, /\{invitation\.nombre_arrive > invitation\.nombre_prevu && \(/);
});

test('libelles : accords et accents corriges, bouton du theme selon la vraie destination', () => {
  const page = read('app/checkin/[invitationId]/page.tsx');
  assert.match(page, /Place \{PLACEMENT_LABELS\[invitation\.placement_status\]\.toLowerCase\(\)\}/);
  assert.doesNotMatch(page, /Placement \{PLACEMENT_LABELS/);
  assert.match(page, /' en table de réserve'/);
  assert.match(page, /'ASSIGNER À CETTE TABLE'/);
  assert.doesNotMatch(page, /' A CETTE TABLE'/);

  const onboarding = read('app/onboarding/theme/page.tsx');
  assert.match(onboarding, /'Continuer vers le tableau de bord'/);
  assert.match(onboarding, /\{continueLabel\}/);
  assert.match(onboarding, /router\.replace\(destination\)/);
});

test('badges d approbations : une reponse est diffusee a tous les badges, /approbations relit apres decision', () => {
  const lib = read('lib/pendingApprovalsRequest.ts');
  assert.match(lib, /export function onPendingApprovalsCount/);
  assert.match(lib, /listeners\.forEach\(\(listener\) => listener\(data\)\)/);
  for (const file of ['components/BottomNav.tsx', 'components/GuestApprovalsShortcut.tsx', 'components/AccountMenu.tsx']) {
    assert.match(read(file), /return onPendingApprovalsCount\(\(data\) => set\w+\(data\.pending_count \|\| 0\)\);/, file);
  }
  assert.match(read('app/approbations/page.tsx'), /await load\(true\);\s*void fetchPendingApprovalsCount\(\);/);
});
