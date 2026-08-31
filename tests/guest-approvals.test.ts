import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canAccessPath, hasCapability } from '../lib/permissions.ts';
import { validateTwilioSignature } from '../lib/twilio.ts';
import { createHmac } from 'node:crypto';

// Invité surprise avec approbation SMS à distance (v1.27.0) -- demande de
// Gersom le 30/08/2026. Inspection du code source, même convention que les
// autres tests de ce dossier (voir floor-plan.test.ts).
const migrationSource = readFileSync(
  new URL('../supabase/migrations/0032_guest_approvals.sql', import.meta.url),
  'utf8'
);
const directorsMigrationSource = readFileSync(
  new URL('../supabase/migrations/0033_festin_directors_contacts.sql', import.meta.url),
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
const appDecideSource = readFileSync(new URL('../app/api/guest-approvals/[id]/decide/route.ts', import.meta.url), 'utf8');
const scannerSource = readFileSync(new URL('../components/QrScanner.tsx', import.meta.url), 'utf8');
const bottomNavSource = readFileSync(new URL('../components/BottomNav.tsx', import.meta.url), 'utf8');
const pushMigrationSource = readFileSync(new URL('../supabase/migrations/0037_guest_approval_app_push.sql', import.meta.url), 'utf8');
const scanPageSource = readFileSync(new URL('../app/scan/page.tsx', import.meta.url), 'utf8');
const guestApprovalPageSource = readFileSync(new URL('../app/scan/guest-approval/page.tsx', import.meta.url), 'utf8');
const approbationsPageSource = readFileSync(new URL('../app/approbations/page.tsx', import.meta.url), 'utf8');
const approveTokenPageSource = readFileSync(new URL('../app/approve/[token]/page.tsx', import.meta.url), 'utf8');
const middlewareSource = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
const accountMenuSource = readFileSync(new URL('../components/AccountMenu.tsx', import.meta.url), 'utf8');
const whatsappInboundSource = readFileSync(
  new URL('../app/api/public/twilio/whatsapp-inbound/route.ts', import.meta.url),
  'utf8'
);
const decideLibSource = readFileSync(new URL('../lib/guestApprovalDecide.ts', import.meta.url), 'utf8');
const whatsappMigrationSource = readFileSync(
  new URL('../supabase/migrations/0034_guest_approval_whatsapp.sql', import.meta.url),
  'utf8'
);

test('les droits photo, approbation et assignation sont separes par role', () => {
  assert.equal(hasCapability('admin', 'submitGuestApproval'), true);
  assert.equal(hasCapability('placeur', 'submitGuestApproval'), true);
  assert.equal(hasCapability('directeur', 'submitGuestApproval'), false);
  assert.equal(hasCapability('visibilite', 'submitGuestApproval'), false);
  assert.equal(hasCapability('agent_checkin', 'submitGuestApproval'), false);
  for (const role of ['admin', 'directeur', 'visibilite'] as const) assert.equal(hasCapability(role, 'reviewGuestApproval'), true);
  assert.equal(hasCapability('placeur', 'reviewGuestApproval'), false);
  assert.equal(hasCapability('agent_checkin', 'reviewGuestApproval'), false);
  assert.equal(hasCapability('admin', 'assignGuestApproval'), true);
  assert.equal(hasCapability('placeur', 'assignGuestApproval'), true);

  assert.equal(canAccessPath('directeur', '/approbations'), true);
  assert.equal(canAccessPath('placeur', '/approbations'), true);
  assert.equal(canAccessPath('agent_checkin', '/approbations'), false);
  assert.equal(canAccessPath('visibilite', '/approbations'), true);
});

test('le bouton central capture le flux video deja ouvert, sans input capture ni app Camera', () => {
  assert.match(scanPageSource, /scannerRef\.current!\.captureFrame\(\)/);
  assert.doesNotMatch(scanPageSource, /Invité surprise \(non prévu\)/);
  assert.match(scannerSource, /context\.drawImage\(video/);
  assert.match(scannerSource, /canvas\.toBlob/);
  assert.doesNotMatch(guestApprovalPageSource, /type="file"/);
  assert.match(bottomNavSource, /Prendre une photo pour approbation/);
  assert.match(accountMenuSource, /hasCapability\(role, ['"]viewGuestApprovals['"]\)/);
  assert.match(accountMenuSource, /href="\/approbations"/);
  assert.match(approbationsPageSource, /hasCapability\(role, ['"]viewGuestApprovals['"]\)/);
});

test('chaque route API verifie la capacite precise cote serveur', () => {
  // "les validations cote interface ne remplacent jamais les controles cote
  // serveur" (docs/DATA_CHANGE_INSTRUCTIONS.md section 7).
  assert.match(createRouteSource, /hasCapability\(user\.role, ['"]submitGuestApproval['"]\)/);
  assert.match(createRouteSource, /hasCapability\(user\.role, ['"]viewGuestApprovals['"]\)/);
  assert.match(assignRouteSource, /hasCapability\(user\.role, ['"]assignGuestApproval['"]\)/);
  assert.match(appDecideSource, /hasCapability\(user\.role, ['"]reviewGuestApproval['"]\)/);
  // La creation et la liste sont dans le meme fichier (POST + GET) -- verifie
  // les deux exports.
  assert.match(createRouteSource, /export async function POST/);
  assert.match(createRouteSource, /export async function GET/);
});

test('la decision dans l app et les abonnements push restent proteges et prives', () => {
  assert.match(appDecideSource, /applyGuestApprovalDecision\(createAdminClient\(\), \{ id: params\.id \}, body\.decision, 'app'\)/);
  assert.match(pushMigrationSource, /decided_via in \('web', 'whatsapp', 'app'\)/);
  assert.match(pushMigrationSource, /alter table push_subscriptions enable row level security/);
  assert.match(pushMigrationSource, /revoke all on table push_subscriptions from anon, authenticated/);
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
  // Le UPDATE (dans la logique partagee lib/guestApprovalDecide.ts, voir plus
  // bas) est garde par statut = 'en_attente' dans le WHERE -- un deuxieme
  // appel touche 0 ligne (verrouillage de ligne Postgres implicite), jamais
  // une double decision silencieuse.
  assert.match(publicDecideSource, /applyGuestApprovalDecision/);
  assert.match(publicDecideSource, /already_decided/);
  assert.match(publicDecideSource, /status: 409/);
});

test('aucun MMS n\'est jamais tente (numero Twilio francais) -- texte seul + lien vers /approve/[token]', () => {
  // Les commentaires du fichier PARLENT de MediaUrl pour expliquer pourquoi
  // on ne l'utilise jamais -- la regle porte sur le corps de la requete
  // envoyee a Twilio, pas sur le mot lui-meme n'importe ou dans le fichier.
  assert.match(twilioSource, /postMessage\(accountSid, authToken, \{ To: to, From: from, Body: body \}\)/);
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

test('festin_directors contient Remy et Tuzola -- confirme par Gersom le 30/08/2026 (migration 0033)', () => {
  assert.match(directorsMigrationSource, /\('Rémy Landu', '\+33651874779'\)/);
  assert.match(directorsMigrationSource, /\('Tuzola', '\+33669016803'\)/);
  assert.match(directorsMigrationSource, /insert into festin_directors/);
});

// Canal WhatsApp (v1.27.0, migration 0034) -- "donne l'option par whatsapp
// ou message... au cas ou il n'a pas de reseau et est connecte au wifi".

test('validateTwilioSignature refuse tout sans authToken/signature (fail closed), jamais un webhook accepte par defaut', () => {
  const originalToken = process.env.TWILIO_AUTH_TOKEN;
  try {
    delete process.env.TWILIO_AUTH_TOKEN;
    assert.equal(validateTwilioSignature('https://example.com/x', { a: '1' }, 'anything'), false);

    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    assert.equal(validateTwilioSignature('https://example.com/x', { a: '1' }, null), false);
    assert.equal(validateTwilioSignature('https://example.com/x', { a: '1' }, 'wrong-signature'), false);

    // Signature correcte (meme algorithme que Twilio : HMAC-SHA1 base64 de
    // l'URL + paires cle+valeur triees par cle, concatenees).
    const url = 'https://example.com/x';
    const params = { b: '2', a: '1' };
    const data = url + Object.keys(params).sort().map((k) => k + (params as any)[k]).join('');
    const validSignature = createHmac('sha1', 'test-token').update(Buffer.from(data, 'utf-8')).digest('base64');
    assert.equal(validateTwilioSignature(url, params, validSignature), true);
  } finally {
    if (originalToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalToken;
  }
});

test('sendWhatsApp utilise un Content Template (jamais de texte libre pour un message initie par l\'app)', () => {
  assert.match(twilioSource, /export async function sendWhatsApp/);
  assert.match(twilioSource, /ContentSid: contentSid/);
  assert.match(twilioSource, /ContentVariables/);
  assert.doesNotMatch(twilioSource, /MediaUrl:/);
  // No-op silencieux (pas d'exception) sans config -- le SMS continue seul.
  assert.match(twilioSource, /if \(!config \|\| !contentSid\) return;/);
});

test('notifyApprover envoie SMS et WhatsApp en parallele, best-effort chacun (l\'echec de l\'un ne bloque pas l\'autre)', () => {
  assert.match(notifySource, /Promise\.allSettled/);
  assert.match(notifySource, /sendWhatsApp\(request\.approver_phone, process\.env\.TWILIO_WHATSAPP_CONTENT_SID_REQUEST/);
  // Seul l'echec du SMS (canal de reference) remonte une exception.
  assert.match(notifySource, /if \(results\[0\]\.status === 'rejected'\) throw results\[0\]\.reason;/);
});

test('le webhook WhatsApp entrant est PUBLIC (signature Twilio, pas de session/capacite) et reutilise la logique de decision partagee', () => {
  assert.doesNotMatch(whatsappInboundSource, /getSessionUser/);
  assert.doesNotMatch(whatsappInboundSource, /hasCapability/);
  assert.match(whatsappInboundSource, /validateTwilioSignature/);
  assert.match(whatsappInboundSource, /invalid_signature/);
  assert.match(whatsappInboundSource, /applyGuestApprovalDecision/);
  assert.match(whatsappInboundSource, /phoneMostRecentPending: from/);
  assert.match(whatsappInboundSource, /'whatsapp'/);
});

test('la reponse WhatsApp reconnait Oui/O/Y/Yes comme approbation et Non/N/No comme refus, insensible a la casse/aux accents', () => {
  assert.match(whatsappInboundSource, /\['oui', 'o', 'y', 'yes', '1'/);
  assert.match(whatsappInboundSource, /\['non', 'n', 'no', '0'/);
  assert.match(whatsappInboundSource, /\.normalize\('NFD'\)/);
  assert.match(whatsappInboundSource, /\.toLowerCase\(\)/);
});

test('applyGuestApprovalDecision est la seule logique de decision atomique, partagee entre /approve/[token] et le webhook WhatsApp', () => {
  assert.match(decideLibSource, /eq\('statut', 'en_attente'\)/);
  assert.match(publicDecideSource, /applyGuestApprovalDecision\(supabase, \{ token \}, decision, 'web'\)/);
  assert.match(whatsappInboundSource, /applyGuestApprovalDecision\(supabase, \{ phoneMostRecentPending: from \}, decision, 'whatsapp'\)/);
  // La route publique ne duplique plus sa propre logique de UPDATE.
  assert.doesNotMatch(publicDecideSource, /\.update\(\{ statut: decision/);
});

test('decided_via (web/whatsapp) est une colonne additive (migration 0034), jamais retirer de donnee existante', () => {
  assert.match(whatsappMigrationSource, /alter table guest_approval_requests/);
  assert.match(whatsappMigrationSource, /add column decided_via text check \(decided_via in \('web', 'whatsapp'\)\)/);
  assert.doesNotMatch(whatsappMigrationSource, /drop /i);
  assert.doesNotMatch(whatsappMigrationSource, /delete from/i);
});

test('le webhook WhatsApp entrant reste sous le prefixe public /api/public (deja couvert par middleware.ts)', () => {
  assert.match(middlewareSource, /'\/api\/public'/);
});
