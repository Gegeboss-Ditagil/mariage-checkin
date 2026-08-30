import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canAccessPath, hasCapability } from '../lib/permissions.ts';

// Invité surprise avec approbation SMS à distance (v1.27.0) -- demande de
// Gersom le 30/08/2026. Inspection du code source, même convention que les
// autres tests de ce dossier (voir floor-plan.test.ts).
const migrationSource = readFileSync(
  new URL('../supabase/migrations/0032_guest_approvals.sql', import.meta.url),
  'utf8'
);
const twilioSource = readFileSync(new URL('../lib/twilio.ts', import.meta.url), 'utf8');
const notifySource = readFileSync(new URL('../lib/guestApprovalNotify.ts', import.meta.url), 'utf8');
const photosSource = readFileSync(new URL('../lib/guestApprovalPhotos.ts', import.meta.url), 'utf8');
const createRouteSource = readFileSync(new URL('../app/api/guest-approvals/route.ts', import.meta.url), 'utf8');
const publicGetSource = readFileSync(
  new URL('../app/api/public/guest-approvals/[token]/route.ts', import.meta.url),
  'utf8'
);
const publicDecideSource = readFileSync(
  new URL('../app/api/public/guest-approvals/[token]/decide/route.ts', import.meta.url),
  'utf8'
);
const assignRouteSource = readFileSync(
  new URL('../app/api/guest-approvals/[id]/assign-table/route.ts', import.meta.url),
  'utf8'
);
const scanPageSource = readFileSync(new URL('../app/scan/page.tsx', import.meta.url), 'utf8');
const guestApprovalPageSource = readFileSync(new URL('../app/scan/guest-approval/page.tsx', import.meta.url), 'utf8');
const approbationsPageSource = readFileSync(new URL('../app/approbations/page.tsx', import.meta.url), 'utf8');
const approveTokenPageSource = readFileSync(new URL('../app/approve/[token]/page.tsx', import.meta.url), 'utf8');
const middlewareSource = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
const accountMenuSource = readFileSync(new URL('../components/AccountMenu.tsx', import.meta.url), 'utf8');

test('la capacite guestApproval est reservee a admin/directeur/placeur, jamais agent scan ni visibilite', () => {
  // Confirme par Gersom : "admin + directeur + placeur" (pas placeur seul --
  // le directeur reste destinataire du SMS de rapport, donc un acteur
  // legitime), et jamais agent_checkin : "si le scanner voit des personnes
  // en plus, il ne fait rien, il va voir le placeur directement".
  assert.equal(hasCapability('admin', 'guestApproval'), true);
  assert.equal(hasCapability('directeur', 'guestApproval'), true);
  assert.equal(hasCapability('placeur', 'guestApproval'), true);
  assert.equal(hasCapability('agent_checkin', 'guestApproval'), false);
  assert.equal(hasCapability('visibilite', 'guestApproval'), false);

  assert.equal(canAccessPath('directeur', '/approbations'), true);
  assert.equal(canAccessPath('placeur', '/approbations'), true);
  assert.equal(canAccessPath('agent_checkin', '/approbations'), false);
  assert.equal(canAccessPath('visibilite', '/approbations'), false);
});

test('le bouton "Invite surprise" sur /scan et le lien "Approbations" du menu sont geres par la capacite guestApproval', () => {
  assert.match(scanPageSource, /hasCapability\(role, ['"]guestApproval['"]\)/);
  assert.match(scanPageSource, /href="\/scan\/guest-approval"/);
  assert.match(accountMenuSource, /hasCapability\(role, ['"]guestApproval['"]\)/);
  assert.match(accountMenuSource, /href="\/approbations"/);
  assert.match(guestApprovalPageSource, /hasCapability\(role, ['"]guestApproval['"]\)/);
  assert.match(approbationsPageSource, /hasCapability\(role, ['"]guestApproval['"]\)/);
});

test('toutes les routes API proteges (creation, liste, assignation) verifient guestApproval cote serveur', () => {
  // "les validations cote interface ne remplacent jamais les controles cote
  // serveur" (docs/DATA_CHANGE_INSTRUCTIONS.md section 7).
  assert.match(createRouteSource, /hasCapability\(user\.role, ['"]guestApproval['"]\)/);
  assert.match(assignRouteSource, /hasCapability\(user\.role, ['"]guestApproval['"]\)/);
  // La creation et la liste sont dans le meme fichier (POST + GET) -- verifie
  // les deux exports.
  assert.match(createRouteSource, /export async function POST/);
  assert.match(createRouteSource, /export async function GET/);
});

test('les routes publiques (/approve/[token]) ne verifient JAMAIS de session -- le token EST l\'autorisation', () => {
  assert.doesNotMatch(publicGetSource, /getSessionUser/);
  assert.doesNotMatch(publicDecideSource, /getSessionUser/);
  assert.doesNotMatch(publicGetSource, /hasCapability/);
  assert.doesNotMatch(publicDecideSource, /hasCapability/);
  assert.match(middlewareSource, /'\/approve'/);
  assert.match(middlewareSource, /'\/api\/public'/);
});

test('la cle de service Supabase ne quitte jamais le serveur -- jamais referencee dans la page publique cote client', () => {
  assert.doesNotMatch(approveTokenPageSource, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(approveTokenPageSource, /createAdminClient/);
  // La page publique ne renvoie que via fetch() vers les routes API -- jamais
  // d'appel Supabase direct depuis le navigateur sur cette table (RLS
  // volontairement fermee, voir la migration).
  assert.doesNotMatch(approveTokenPageSource, /createClient/);
});

test('la decision (approuver/refuser) est atomique et invalide le token apres usage', () => {
  // Le UPDATE est garde par statut = 'en_attente' dans le WHERE -- un
  // deuxieme appel touche 0 ligne (verrouillage de ligne Postgres implicite),
  // jamais une double decision silencieuse.
  assert.match(publicDecideSource, /\.eq\('statut', 'en_attente'\)/);
  assert.match(publicDecideSource, /already_decided/);
  assert.match(publicDecideSource, /status: 409/);
});

test('aucun MMS n\'est jamais tente (numero Twilio francais) -- texte seul + lien vers /approve/[token]', () => {
  // Les commentaires du fichier PARLENT de MediaUrl pour expliquer pourquoi
  // on ne l'utilise jamais -- la regle porte sur le corps de la requete
  // envoyee a Twilio, pas sur le mot lui-meme n'importe ou dans le fichier.
  assert.match(twilioSource, /new URLSearchParams\(\{ To: to, From: from, Body: body \}\)/);
  assert.doesNotMatch(twilioSource, /MediaUrl:/);
  assert.doesNotMatch(notifySource, /\.photo_url/); // le SMS ne transporte jamais la photo elle-meme
  assert.match(notifySource, /approveUrl/);
});

test('le bucket Supabase Storage est prive, jamais public', () => {
  assert.match(migrationSource, /insert into storage\.buckets \(id, name, public\)/);
  assert.match(migrationSource, /'guest-approval-photos', 'guest-approval-photos', false/);
  assert.match(photosSource, /createSignedUrl/);
});

test('guest_approval_requests n\'a AUCUNE policy RLS anon -- le token doit rester confidentiel', () => {
  assert.match(migrationSource, /alter table guest_approval_requests enable row level security/);
  assert.doesNotMatch(migrationSource, /create policy .*guest_approval_requests/);
  assert.doesNotMatch(migrationSource, /public read guest_approval/);
});

test('assign_table_to_guest_approval refuse une demande pas encore approuvee ou deja assignee, et n\'utilise pas addInvitation', () => {
  // Action etroite (capacite guestApproval), volontairement distincte de
  // /api/invitations/add (capacite addInvitation, reservee a l'admin) : ne
  // peut agir que sur une demande DEJA approuvee par SMS.
  assert.match(migrationSource, /if v_req\.statut <> 'approuve' then/);
  assert.match(migrationSource, /raise exception 'request_not_approved'/);
  assert.match(migrationSource, /if v_req\.table_id is not null then/);
  assert.match(migrationSource, /raise exception 'request_already_assigned'/);
  // Le commentaire du fichier PARLE d'addInvitation pour expliquer pourquoi
  // cette route ne l'utilise pas -- la regle porte sur l'appel de capacite
  // reel (hasCapability(..., 'addInvitation')), jamais present ici.
  assert.doesNotMatch(assignRouteSource, /hasCapability\([^)]*['"]addInvitation['"]\)/);
  assert.match(assignRouteSource, /assign_table_to_guest_approval/);
});

test('la table de reserve calcule les places restantes avec le meme calcul que /dashboard et /plan-table', () => {
  assert.match(notifySource, /computeTableCapacities/);
  assert.match(notifySource, /is_reserve/);
  assert.match(notifySource, /libresMaintenant/);
});

test('le SMS de rapport au directeur de festin est un no-op silencieux tant que festin_directors est vide', () => {
  assert.match(notifySource, /if \(list\.length === 0\) return \{ sent: 0, failed: 0 \}/);
  assert.match(migrationSource, /create table festin_directors/);
});

test('"Mon Papa" (Canada) = Cote Gege, "Papa David" (France) = Cote Nelly -- confirme par Gersom le 30\/08\/2026', () => {
  assert.match(migrationSource, /\('Gege', 'Mon Papa', '\+15148151586'\)/);
  assert.match(migrationSource, /\('Nelly', 'Papa David', '\+33643348560'\)/);
});
