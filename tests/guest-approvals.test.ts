import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canAccessPath, hasCapability } from '../lib/permissions.ts';
import { validateTwilioSignature, sendSms, sendWhatsApp, TwilioConfigError } from '../lib/twilio.ts';
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
const clientCacheSource = readFileSync(new URL('../lib/guestApprovalClientCache.ts', import.meta.url), 'utf8');
const splashSource = readFileSync(new URL('../components/SplashScreen.tsx', import.meta.url), 'utf8');
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
const strictAssignmentSource = readFileSync(
  new URL('../supabase/migrations/0038_strict_guest_approval_assignment.sql', import.meta.url),
  'utf8'
);
const publicApprovalGetRouteSource = readFileSync(
  new URL('../app/api/public/guest-approvals/[token]/route.ts', import.meta.url),
  'utf8'
);
const assignPageSource = readFileSync(new URL('../app/approbations/[id]/assign/page.tsx', import.meta.url), 'utf8');
const webPushSource = readFileSync(new URL('../lib/webPush.ts', import.meta.url), 'utf8');
const pushButtonSource = readFileSync(new URL('../components/PushNotificationButton.tsx', import.meta.url), 'utf8');
const pushKeyRouteSource = readFileSync(new URL('../app/api/push/vapid-public-key/route.ts', import.meta.url), 'utf8');
const pushSubscribeRouteSource = readFileSync(new URL('../app/api/push/subscribe/route.ts', import.meta.url), 'utf8');
const guestApprovalsShortcutSource = readFileSync(new URL('../components/GuestApprovalsShortcut.tsx', import.meta.url), 'utf8');
const swSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

test('les droits photo, approbation et assignation sont separes par role', () => {
  assert.equal(hasCapability('admin', 'submitGuestApproval'), true);
  assert.equal(hasCapability('placeur', 'submitGuestApproval'), true);
  assert.equal(hasCapability('directeur', 'submitGuestApproval'), true);
  assert.equal(hasCapability('visibilite', 'submitGuestApproval'), false);
  assert.equal(hasCapability('agent_checkin', 'submitGuestApproval'), false);
  for (const role of ['admin', 'directeur', 'visibilite'] as const) assert.equal(hasCapability(role, 'reviewGuestApproval'), true);
  assert.equal(hasCapability('placeur', 'reviewGuestApproval'), false);
  assert.equal(hasCapability('agent_checkin', 'reviewGuestApproval'), false);
  assert.equal(hasCapability('admin', 'assignGuestApproval'), true);
  assert.equal(hasCapability('placeur', 'assignGuestApproval'), true);
  assert.equal(hasCapability('directeur', 'assignGuestApproval'), true);
  assert.equal(hasCapability('visibilite', 'assignGuestApproval'), true);
  assert.equal(hasCapability('agent_checkin', 'assignGuestApproval'), false);

  assert.equal(canAccessPath('directeur', '/approbations'), true);
  assert.equal(canAccessPath('placeur', '/approbations'), true);
  assert.equal(canAccessPath('visibilite', '/approbations'), true);

  // agent_checkin gagne viewGuestApprovals en LECTURE SEULE le 13/09/2026
  // (retour de Gersom : "en bas a droite... ca devrait etre approbation")
  // -- la liste (avec badge) est visible, mais jamais reviewGuestApproval
  // ni assignGuestApproval (deja verifie ci-dessus) : ce role continue de
  // renvoyer vers un placeur pour decider/assigner.
  assert.equal(hasCapability('agent_checkin', 'viewGuestApprovals'), true);
  assert.equal(canAccessPath('agent_checkin', '/approbations'), true);
});

test("la lecture publique d'une approbation ne doit jamais etre mise en cache", () => {
  assert.match(publicApprovalGetRouteSource, /Cache-Control': 'private, no-store'/);
});

test('une demande est ouvrable et montre photo, cote, decision et choix de table dans l application', () => {
  assert.match(approbationsPageSource, /setSelectedId\(r\.id\)/);
  assert.match(approbationsPageSource, /role="dialog"/);
  // Photo resserrée le 13/09/2026 (42dvh -> 26dvh) pour tenir sans défiler.
  assert.match(approbationsPageSource, /max-h-\[26dvh\]/);
  assert.match(approbationsPageSource, /Côté \{selectedRequest\.cote/);
  assert.match(approbationsPageSource, />Approuver<\/button>/);
  assert.match(approbationsPageSource, />Refuser<\/button>/);
  assert.match(approbationsPageSource, /Oui — voir les recommandations/);
  assert.match(approbationsPageSource, /Non — laisser le placeur l'assigner/);
  assert.match(approbationsPageSource, /demande reste approuvée et sans table/);
});

test('la fenetre detaillee navigue entre les demandes et confirme clairement chaque decision', () => {
  assert.match(approbationsPageSource, /Demande précédente/);
  assert.match(approbationsPageSource, /Demande suivante/);
  assert.match(approbationsPageSource, /moveSelection\(-1\)/);
  assert.match(approbationsPageSource, /moveSelection\(1\)/);
  assert.match(approbationsPageSource, /aucune table n’avait de place libre/);
  assert.match(approbationsPageSource, /Parfait — demande refusée/);
  assert.match(approbationsPageSource, /Approuvé — Table/);
  assert.match(approbationsPageSource, /Approuvé — sans table/);
});

test('la fiche approbation est remontee, structure ses informations et utilise des fleches iOS en verre', () => {
  assert.match(approbationsPageSource, /items-center justify-center overflow-y-auto/);
  assert.match(approbationsPageSource, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(approbationsPageSource, /ChevronLeftIcon/);
  assert.match(approbationsPageSource, /ChevronRightIcon/);
  assert.match(approbationsPageSource, /h-14 w-14/);
  assert.match(approbationsPageSource, /backdrop-blur-2xl/);
  assert.match(approbationsPageSource, />Nom<\/p>/);
  assert.match(approbationsPageSource, />Invités<\/p>/);
  assert.match(approbationsPageSource, />Demandé par<\/p>/);
  assert.match(approbationsPageSource, />Placement<\/p>/);
});

test('les photos d approbation sont signees en lot, mises en cache et prechargees pendant le splash', () => {
  assert.match(photosSource, /createSignedUrls\(missing, SIGNED_URL_TTL_SECONDS\)/);
  assert.match(photosSource, /signedUrlCache/);
  assert.match(createRouteSource, /getSignedPhotoUrls/);
  assert.doesNotMatch(createRouteSource, /map\(async \(row: any\)/);
  assert.match(clientCacheSource, /slice\(0, 6\)/);
  assert.match(clientCacheSource, /image\.src = request\.photo_signed_url/);
  assert.match(splashSource, /if \(warmApprovals\) void warmGuestApprovals\(\)/);
  assert.match(splashSource, /router\.prefetch\(next\)/);
  assert.match(clientCacheSource, /clearGuestApprovalsCache/);
  assert.match(accountMenuSource, /clearGuestApprovalsCache\(\)/);
  assert.match(createRouteSource, /Cache-Control': 'private, no-store'/);
});

test('la photo prise depuis le scanner est redimensionnee avant upload', () => {
  assert.match(scannerSource, /const maxDimension = 1280/);
  assert.match(scannerSource, /Math\.min\(1, maxDimension \/ Math\.max\(video\.videoWidth, video\.videoHeight\)\)/);
  assert.match(scannerSource, /canvas\.toBlob\(resolve, 'image\/jpeg', 0\.8\)/);
});

test('texto et WhatsApp ne choisissent jamais la table; l assignation reste une action authentifiee separee', () => {
  assert.doesNotMatch(whatsappInboundSource, /table_id|assign_table_to_guest_approval/);
  assert.doesNotMatch(publicDecideSource, /table_id|assign_table_to_guest_approval/);
  assert.match(assignRouteSource, /hasCapability\(user\.role, ['"]assignGuestApproval['"]\)/);
});

test('l assignation stricte libere les places atomiquement et interdit de deplacer une personne arrivee', () => {
  assert.match(assignRouteSource, /assign_table_to_guest_approval_strict/);
  assert.match(assignRouteSource, /p_relocations: relocations/);
  assert.match(strictAssignmentSource, /for update/);
  assert.match(strictAssignmentSource, /arrived_guest_cannot_move/);
  assert.match(strictAssignmentSource, /target_capacity_exceeded/);
  assert.match(strictAssignmentSource, /destination_capacity_exceeded/);
  assert.match(strictAssignmentSource, /guest_approval_capacity_relocation/);
});

test('la page montre les statuts et exige une destination suffisante avant de confirmer', () => {
  assert.match(assignPageSource, /STATUS_LABELS\[inv\.statut\]/);
  assert.match(assignPageSource, /PLACEMENT_LABELS\[inv\.placement_status\]/);
  assert.match(assignPageSource, /Déjà arrivé\/assis — déplacement interdit/);
  assert.match(assignPageSource, /minimumEstimatedFree=\{seatsFreed\}/);
  assert.match(assignPageSource, /!relocationReady/);
});

test('le choix rapide ne montre que les tables réellement libres et priorise la table du groupe arrivé-avec, puis la table 42', () => {
  assert.match(assignPageSource, /Tables disponibles/);
  assert.match(assignPageSource, /libresEstimees >= needed/);
  // Priorité 0 ajoutée le 13/09/2026 : la table du groupe avec qui l'invité
  // est arrivé (linked_invitation_table_id) passe devant la table 42 (41
  // avant le 14/09/2026, v1.47.0) -- voir
  // tests/approbations-ux-improvements.test.ts pour la présélection
  // automatique associée.
  assert.match(assignPageSource, /usage\.table\.number === 42 \? 1/);
  // Texte raccourci le 13/09/2026 (retour de Gersom : "le texte est
  // long... plus intuitif") -- voir tests/approbations-ux-improvements.test.ts.
  assert.match(assignPageSource, /Touchez une autre table pour changer\./);
});

test('la fiche a un vrai bouton fermer et rend le placement actionnable après approbation ; en attente, le placement est automatique', () => {
  assert.match(approbationsPageSource, /aria-label="Fermer la demande"/);
  assert.match(approbationsPageSource, /<CloseIcon/);
  assert.match(approbationsPageSource, /Choisir une table/);
  assert.doesNotMatch(approbationsPageSource, /Approuvez d’abord la demande/);
  // Retire le 02/09/2026 (retour de Gersom : "je n'ai pas besoin de voir
  // reserver une table directement... etre capable de approuver ou refuser
  // rapidement") -- le placement se fait desormais tout seul a
  // l'approbation (voir tests/guest-approval-reservation.test.ts pour le
  // placement automatique), plus de lien de reservation manuelle sur cette
  // page.
  assert.doesNotMatch(approbationsPageSource, /Réserver une table/);
  assert.doesNotMatch(approbationsPageSource, /réservée — modifier/);
  assert.match(approbationsPageSource, /Placée automatiquement à l’approbation/);
});

test('les alertes dans l application restent actives meme sans cles VAPID', () => {
  // Le sondage du badge vit desormais dans hooks/usePolling (pause auto en
  // arriere-plan), mais reste branche sur le meme chargement 5s quand
  // l'ecran est visible -- le compte garde son alerte "Nouvelle approbation".
  assert.match(accountMenuSource, /usePolling\(loadPendingApprovals, canPollApprovals \? 5000 : 0\)/);
  assert.match(accountMenuSource, /Nouvelle approbation/);
  assert.match(pushButtonSource, /Alertes dans l.application actives/);
  assert.match(webPushSource, /approbations\?request=\$\{request\.id\}/);
});

test('les placeurs peuvent s abonner au push sans recevoir le droit d approuver', () => {
  assert.match(pushKeyRouteSource, /hasCapability\(user\.role, 'viewGuestApprovals'\)/);
  assert.match(pushSubscribeRouteSource, /hasCapability\(user\.role, 'viewGuestApprovals'\)/);
  assert.doesNotMatch(pushKeyRouteSource, /hasCapability\(user\.role, 'reviewGuestApproval'\)/);
  assert.doesNotMatch(pushSubscribeRouteSource, /hasCapability\(user\.role, 'reviewGuestApproval'\)/);
  assert.equal(hasCapability('placeur', 'viewGuestApprovals'), true);
  assert.equal(hasCapability('placeur', 'reviewGuestApproval'), false);
});

test('tous les placeurs abonnes recoivent le resultat et le lien d assignation', () => {
  assert.match(webPushSource, /user\.role === 'placeur'/);
  assert.match(webPushSource, /attend à la porte · assignez une table/);
  assert.match(webPushSource, /approbations\/\$\{request\.id\}\/assign/);
  // Depuis le 02/09/2026, tableNumber n'est plus toujours null a la
  // decision : une reservation posee avant l'approbation (0044) est
  // finalisee dans la meme fonction, donc le vrai numero de table est
  // passe des qu'il existe (voir lib/guestApprovalDecide.ts).
  assert.match(decideLibSource, /notifyGuestApprovalPlaceurs\(supabase, updated, tableNumber\)/);
  assert.match(assignRouteSource, /notifyGuestApprovalPlaceurs\(supabase, request, table\.number\)/);
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
  // 'app' + l'id de l'agent connecte -- ajoute le 02/09/2026 pour finaliser
  // une reservation posee avant l'approbation (voir 0044) avec le bon
  // p_agent_id sur assign_table_to_guest_approval_strict.
  // Le 6e argument (true, ajoute le 13/09/2026) autorise reconsiderer un
  // refus -> approuve depuis l'app -- voir tests/approbations-ux-improvements.test.ts.
  assert.match(appDecideSource, /applyGuestApprovalDecision\(createAdminClient\(\), \{ id: params\.id \}, body\.decision, 'app', user\.id, true\)/);
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
  // /api/invitations/add (capacite addInvitation, admin/directeur) : ne
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

// v1.48.3 -- demande de Gersom : Twilio reste desactive intentionnellement
// pour l'instant ("c'est toggle off... on activera plus tard"). v1.53.2 :
// l'interrupteur n'est plus une variable d'environnement (TWILIO_ENABLED,
// necessitait un acces Vercel) mais `events.twilio_enabled` (migration 0055),
// lu par l'appelant et passe explicitement en parametre `enabled` a
// sendSms/sendWhatsApp -- reactiver depuis /admin ne doit demander aucun
// changement de code. Tests comportementaux (pas seulement une inspection du
// source) : verifient qu'aucune requete reseau n'est meme tentee quand
// `enabled` est faux, et que sendSms/sendWhatsApp s'adaptent automatiquement
// une fois `enabled` vrai.
test('enabled=false (Twilio desactive pour l\'evenement) : aucune requete reseau tentee', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  try {
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    await assert.rejects(() => sendSms('+33600000000', 'test', false), TwilioConfigError);
    assert.equal(fetchCalled, false, 'sendSms ne doit tenter aucune requete reseau quand enabled=false');

    // sendWhatsApp est concu pour un no-op silencieux (canal optionnel) --
    // enabled=false doit produire le meme silence, jamais une requete.
    await sendWhatsApp('+33600000000', 'HX123', { '1': 'x' }, false);
    assert.equal(fetchCalled, false, 'sendWhatsApp ne doit tenter aucune requete reseau quand enabled=false');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('enabled=true reactive Twilio sans autre changement de code (le parametre explicite, pas seulement les identifiants)', async () => {
  const originalSid = process.env.TWILIO_ACCOUNT_SID;
  const originalToken = process.env.TWILIO_AUTH_TOKEN;
  const originalFrom = process.env.TWILIO_PHONE_NUMBER;
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;
  let sawAbortSignal = false;
  try {
    // Sans identifiants, meme enabled=true, reste une erreur de
    // configuration explicite (pas juste "desactive") -- le toggle ne
    // remplace jamais la verification des identifiants, il s'y ajoute.
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    await assert.rejects(() => sendSms('+33600000000', 'test', true), TwilioConfigError);

    process.env.TWILIO_ACCOUNT_SID = 'ACtest';
    process.env.TWILIO_AUTH_TOKEN = 'test-token';
    process.env.TWILIO_PHONE_NUMBER = '+15551234567';
    globalThis.fetch = (async (_url: unknown, init: any) => {
      fetchCalled = true;
      sawAbortSignal = init?.signal instanceof AbortSignal;
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    await sendSms('+33600000000', 'test', true);
    assert.equal(fetchCalled, true, 'sendSms doit tenter la requete une fois enabled=true et les identifiants presents');
    assert.equal(sawAbortSignal, true, 'la requete doit rester bornee par un AbortSignal (voir TWILIO_REQUEST_TIMEOUT_MS)');
  } finally {
    if (originalSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = originalSid;
    if (originalToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalToken;
    if (originalFrom === undefined) delete process.env.TWILIO_PHONE_NUMBER;
    else process.env.TWILIO_PHONE_NUMBER = originalFrom;
    globalThis.fetch = originalFetch;
  }
});

// v1.53.2, retour de Gersom (16/09/2026, capture d'ecran "Demande
// d'approbation") : "assure-toi qu'on n'a pas ce message concernant
// Twilio... si c'est desactive, tous ces problemes-la disparaissent" -- le
// message d'erreur Twilio ne doit plus s'afficher a l'agent tant que le
// toggle admin (events.twilio_enabled) reste volontairement desactive.
test('la route de creation distingue "Twilio volontairement desactive" (sms_skipped) d\'un vrai echec d\'envoi (sms_error)', () => {
  assert.match(createRouteSource, /sms_skipped: smsSkipped/);
  assert.match(createRouteSource, /if \(err instanceof TwilioConfigError && !event\.twilio_enabled\)/);
  assert.match(createRouteSource, /smsSkipped = true;/);
});

test('le bouton "Invité surprise" n\'affiche plus le message Twilio quand la demande est simplement sautee (smsSkipped)', () => {
  const captureFlowSource = readFileSync(new URL('../components/GuestApprovalCaptureFlow.tsx', import.meta.url), 'utf8');
  assert.match(captureFlowSource, /!confirmation\.smsSent && !confirmation\.smsSkipped/);
});

test('un bouton admin dans /admin active/desactive Twilio (events.twilio_enabled), sans passer par une variable d\'environnement Vercel', () => {
  const adminPageSource = readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  const adminEventRouteSource = readFileSync(new URL('../app/api/admin/event/route.ts', import.meta.url), 'utf8');
  assert.match(adminPageSource, /twilio_enabled: !event\.twilio_enabled/);
  assert.match(adminEventRouteSource, /patch\.twilio_enabled = Boolean\(twilio_enabled\);/);
});

test('notifyApprover envoie SMS et WhatsApp en parallele, best-effort chacun (l\'echec de l\'un ne bloque pas l\'autre)', () => {
  assert.match(notifySource, /Promise\.allSettled/);
  assert.match(notifySource, /sendWhatsApp\(\s*\n\s*request\.approver_phone,\s*\n\s*process\.env\.TWILIO_WHATSAPP_CONTENT_SID_REQUEST/);
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

// Corrige le 02/09/2026 (retour de Gersom : "j'ai comme l'impression que la
// valeur deux est hard coded... assure-toi que les approbations, c'est en
// live"). Le badge (AccountMenu, BottomNav, GuestApprovalsShortcut) reste
// fige sur un ancien compte si la reponse GET ?count=pending est mise en
// cache par le navigateur -- il faut a la fois que le serveur l'exclue
// explicitement du cache HTTP et que chaque appelant le demande sans cache.
test('le compte d\'approbations en attente est explicitement exclu du cache HTTP, cote serveur et cote client', () => {
  assert.match(
    createRouteSource,
    /pending_count: count \|\| 0, latest: latest \|\| null \},\s*\n\s*\{ headers: \{ 'Cache-Control': 'private, no-store' \} \}/
  );
  for (const source of [accountMenuSource, bottomNavSource, guestApprovalsShortcutSource]) {
    assert.match(source, /fetch\('\/api\/guest-approvals\?count=pending', \{ cache: 'no-store' \}\)/);
  }
});

test('les approbations et abonnements push utilisent evenement de la session, jamais le premier evenement', () => {
  assert.match(createRouteSource, /\.eq\('id', user\.event_id\)\s*\n?\s*\.maybeSingle\(\)/);
  assert.match(pushSubscribeRouteSource, /\.eq\('id', user\.event_id\)\.maybeSingle\(\)/);
  assert.match(clientCacheSource, /cache: 'no-store'/);
});

test('les notifications push sont activables sur Android et iOS installe, avec erreurs visibles', () => {
  assert.match(pushButtonSource, /display-mode: standalone/);
  assert.match(pushButtonSource, /navigator\.serviceWorker\.ready/);
  assert.match(pushButtonSource, /Echec activation notifications push/);
  assert.match(pushButtonSource, /Notifications activées/);
});

// v1.48.3 -- bug signale par Gersom (capture d'ecran "Reconsiderer et
// placer") : "les trois petits points restent la tres longtemps... ca prend
// vraiment du temps a approuver". Root cause (lecture du code, jamais
// reproductible autrement que par une vraie latence Twilio/push) : les
// notifications SMS/WhatsApp et Push envoyees apres une decision sont
// documentees "best-effort" (un `catch` les avale partout) mais etaient
// attendues en sequence et sans aucune limite de temps avant de repondre a
// l'agent -- un `fetch`/`sendNotification` bloque pouvait laisser le bouton
// sur "..." indefiniment. Corrige : timeout borne des deux cotes (Twilio,
// Push) + les deux envois independants lances en parallele plutot qu'en
// sequence, partout ou ce meme motif existait (decision normale,
// reconsideration, assignation d'un invite deja approuve).
test('les notifications best-effort (SMS, WhatsApp, Push) sont bornees dans le temps, jamais un fetch/sendNotification sans limite', () => {
  assert.match(twilioSource, /signal: AbortSignal\.timeout\(TWILIO_REQUEST_TIMEOUT_MS\)/);
  assert.match(webPushSource, /\{ timeout: PUSH_REQUEST_TIMEOUT_MS \}/);
  // Un timeout de plusieurs minutes ne resoudrait pas le probleme signale --
  // doit rester de l'ordre de quelques secondes.
  const twilioTimeout = Number(twilioSource.match(/TWILIO_REQUEST_TIMEOUT_MS = (\d+);/)?.[1]);
  const pushTimeout = Number(webPushSource.match(/PUSH_REQUEST_TIMEOUT_MS = (\d+);/)?.[1]);
  assert.ok(twilioTimeout > 0 && twilioTimeout <= 15000, 'le timeout Twilio doit rester de l\'ordre de quelques secondes');
  assert.ok(pushTimeout > 0 && pushTimeout <= 15000, 'le timeout Push doit rester de l\'ordre de quelques secondes');
});

test('la confirmation SMS/WhatsApp et le Push aux placeurs sont envoyes en parallele apres une decision, jamais en sequence', () => {
  assert.match(decideLibSource, /Promise\.allSettled\(\[\s*\n\s*notifyApproverDecision\(updated, decision, reserveRemaining, twilioEnabled\)\.catch/);
  assert.match(decideLibSource, /notifyGuestApprovalPlaceurs\(supabase, updated, tableNumber\)\.catch/);
});

test('le rapport aux directeurs de festin et le Push aux placeurs sont envoyes en parallele apres une assignation directe, jamais en sequence', () => {
  assert.match(
    assignRouteSource,
    /Promise\.allSettled\(\[\s*\n\s*notifyFestinDirectors\(supabase, request, table\.number, reserveRemaining, twilioEnabled\),/
  );
  assert.match(assignRouteSource, /notifyGuestApprovalPlaceurs\(supabase, request, table\.number\)\.catch/);
});

// v1.48.4 -- demande de Gersom : "le petit 1 indicateur sur l'icône avant de
// l'ouvrir". Badge numerique sur l'icone de l'app (Badging API), distinct du
// badge affiche a l'interieur de l'app une fois ouverte (tests/app-badge.ts
// couvre le comportement de lib/appBadge.ts lui-meme) -- ici, on verrouille
// le CABLAGE bout en bout : le serveur calcule et envoie badgeCount, le
// service worker le lit et appelle la Badging API en tache de fond (avant
// meme l'ouverture de l'app), et les trois sondeurs en premier plan
// (AccountMenu/BottomNav/GuestApprovalsShortcut) le recalent a chaque
// rafraichissement du compte, avec le meme compte que pending_count.
test('notifyGuestApprovalReviewers envoie un badgeCount (meme compte que pending_count) dans le payload Push', () => {
  assert.match(webPushSource, /eq\('event_id', request\.event_id\)\s*\n\s*\.eq\('statut', 'en_attente'\);/);
  assert.match(webPushSource, /badgeCount: badgeCount \?\? 0,/);
});

test("le service worker met a jour le badge numerique de l'icone a la reception d'un Push, avant meme l'ouverture de l'app", () => {
  assert.match(swSource, /'setAppBadge' in navigator/);
  assert.match(swSource, /data\.badgeCount > 0 \? navigator\.setAppBadge\(data\.badgeCount\) : navigator\.clearAppBadge\(\)/);
  // Le badge ne doit jamais empecher l'affichage de la notification
  // elle-meme si l'API est absente ou si l'appel echoue.
  assert.match(swSource, /event\.waitUntil\(Promise\.all\(\[showNotification, badgeUpdate\]\)\);/);
});

test("les trois sondeurs en premier plan (AccountMenu/BottomNav/GuestApprovalsShortcut) recalent le badge de l'icone avec le meme compte pending_count", () => {
  for (const source of [accountMenuSource, bottomNavSource, guestApprovalsShortcutSource]) {
    assert.match(source, /from '@\/lib\/appBadge'/);
    assert.match(source, /syncAppBadge\(nextCount\)/);
  }
});

test("le badge de l'icone est efface a la deconnexion (partage par appareil, pas par compte)", () => {
  assert.match(accountMenuSource, /clearAppBadge\(\)/);
});
