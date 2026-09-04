import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Retour de Gersom le 02/09/2026 (voir le prompt complet dans l'historique) :
// "on aura la possibilité, quand [un groupe] arrive, [de savoir] s'il y a
// des sous-invités supplémentaires qui viennent avec le groupe... comme ça
// ce champ sera prérempli... si c'est des gens qui sont venus avec
// quelqu'un, au lieu de prioriser la table excédentaire, on va commencer
// par prioriser la table déjà avec qui ils sont venus."
// Option retenue (confirmée explicitement) : le bouton rapide "+ Non prévu"
// ET le nouveau parcours photo lié coexistent, tous deux réservés à
// submitGuestApproval -- "les scanners ne vont même pas traiter votre
// demande... c'est les placeurs qui vont gérer le reste, car ils auront les
// bons accès".

const linkedMigration = readFileSync(
  new URL('../supabase/migrations/0046_guest_approval_linked_invitation.sql', import.meta.url),
  'utf8'
);
const addUnplannedRouteSource = readFileSync(
  new URL('../app/api/members/add-unplanned/route.ts', import.meta.url),
  'utf8'
);
const guestApprovalsRouteSource = readFileSync(new URL('../app/api/guest-approvals/route.ts', import.meta.url), 'utf8');
const captureFlowSource = readFileSync(new URL('../components/GuestApprovalCaptureFlow.tsx', import.meta.url), 'utf8');
const checkinPageSource = readFileSync(new URL('../app/checkin/[invitationId]/page.tsx', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('../lib/types.ts', import.meta.url), 'utf8');

test("l'ajout d'un invité imprévu ('+ Non prévu') exige désormais submitGuestApproval, jamais checkin seul -- un excédent de personnes remonte toujours à un placeur/directeur/admin", () => {
  assert.match(addUnplannedRouteSource, /hasCapability\(user\.role, 'submitGuestApproval'\)/);
  assert.doesNotMatch(addUnplannedRouteSource, /hasCapability\(user\.role, 'checkin'\)/);
});

test("le check-in normal (set-arrival-status, marquer présents des invités déjà prévus) reste inchangé, toujours sur 'checkin'", () => {
  const arrivalRouteSource = readFileSync(new URL('../app/api/members/set-arrival-status/route.ts', import.meta.url), 'utf8');
  assert.match(arrivalRouteSource, /hasCapability\(user\.role, 'checkin'\)/);
});

test("auto_assign_table_for_guest_approval priorise d'abord la table du groupe lié (linked_invitation_id), avant même la table excédentaire", () => {
  assert.match(linkedMigration, /alter table guest_approval_requests add column if not exists linked_invitation_id uuid references invitations\(id\)/);
  assert.match(linkedMigration, /create or replace function auto_assign_table_for_guest_approval/);
  // Priorite 0 (groupe lie) doit apparaitre AVANT priorite 1 (reserve) dans le texte.
  const idxLinked = linkedMigration.indexOf('Priorite 0');
  const idxReserve = linkedMigration.indexOf('Priorite 1');
  assert.ok(idxLinked > 0 && idxReserve > idxLinked, 'Priorite 0 (groupe lie) doit precéder Priorite 1 (reserve)');
  assert.match(linkedMigration, /if v_req\.linked_invitation_id is not null then/);
  assert.match(linkedMigration, /select i\.table_id into v_linked_table_id from invitations i where i\.id = v_req\.linked_invitation_id/);
  assert.match(linkedMigration, /security invoker set search_path = public, pg_temp/);
});

test("l'API /api/guest-approvals accepte un invitation_id optionnel, le vérifie (même événement) avant de le lier, jamais bloquant si absent ou invalide", () => {
  assert.match(guestApprovalsRouteSource, /const invitationIdRaw = form\.get\('invitation_id'\)/);
  assert.match(guestApprovalsRouteSource, /\.eq\('event_id', event\.id\)/);
  assert.match(guestApprovalsRouteSource, /linked_invitation_id: verifiedLinkedInvitationId/);
  assert.match(typesSource, /linked_invitation_id: string \| null/);
});

test('GuestApprovalCaptureFlow saute l\'étape "quel côté" quand initialCote est fourni, et transmet invitation_id dans la requête', () => {
  assert.match(captureFlowSource, /initialCote\?: Exclude<Cote, 'Neutre'>/);
  assert.match(captureFlowSource, /linkedInvitationId\?: string/);
  assert.match(captureFlowSource, /useState<Step>\(initialCote \? 'form' : 'cote'\)/);
  assert.match(captureFlowSource, /useState<Cote \| null>\(initialCote \?\? null\)/);
  assert.match(captureFlowSource, /if \(linkedInvitationId\) form\.append\('invitation_id', linkedInvitationId\)/);
});

// Alerte CodeQL ("DOM text reinterpreted as HTML") sur l'aperçu photo :
// `preview` (état React alimenté par URL.createObjectURL) est rendu tel
// quel comme src d'image, sans que le type `string` ne prouve qu'il s'agit
// bien d'une URL blob: locale. Corrigé par un garde-fou explicite (préfixe
// whitelist) qui rend la contrainte vérifiable statiquement.
test("l'aperçu photo de GuestApprovalCaptureFlow ne peut atteindre l'attribut src qu'en tant qu'URL blob: locale (garde-fou CodeQL)", () => {
  assert.match(captureFlowSource, /const safePreview = preview\.startsWith\('blob:'\) \? preview : '';/);
  assert.match(captureFlowSource, /<img src=\{safePreview\}/);
  assert.doesNotMatch(captureFlowSource, /<img src=\{preview\}/);
});

// Le "+ Non prévu" autonome de cette page a disparu le 03/09/2026 (consolide
// dans le "+" de GuestArrivalPanel, voir tests/guest-arrival-panel.test.ts)
// -- seul reste ici le parcours photo, pour les cas ou une approbation
// visuelle stricte est voulue.
test("/checkin/[invitationId] offre '📷 Invité surprise' pour submitGuestApproval, et un message sans bouton pour les autres rôles (jamais agent_checkin)", () => {
  assert.match(checkinPageSource, /const canSubmitGuestApproval = hasCapability\(role, 'submitGuestApproval'\)/);
  assert.match(checkinPageSource, /!canSubmitGuestApproval \? \(/);
  assert.match(checkinPageSource, /Une personne en plus \? Un placeur ou directeur peut l’ajouter\./);
  assert.match(checkinPageSource, /accept="image\/\*"/);
  assert.match(checkinPageSource, /capture="environment"/);
  assert.match(checkinPageSource, /📷 Invité surprise/);
});

test('le champ photo du check-in lie automatiquement la demande à l\'invitation courante (côté et groupe déjà connus, sans avoir à les ressaisir)', () => {
  assert.match(checkinPageSource, /const \[surprisePhoto, setSurprisePhoto\] = useState<File \| null>\(null\)/);
  assert.match(
    checkinPageSource,
    /initialCote=\{invitation\.cote === 'Gege' \|\| invitation\.cote === 'Nelly' \? invitation\.cote : undefined\}/
  );
  assert.match(checkinPageSource, /linkedInvitationId=\{invitation\.id\}/);
  assert.match(checkinPageSource, /onClose=\{\(\) => setSurprisePhoto\(null\)\}/);
});
