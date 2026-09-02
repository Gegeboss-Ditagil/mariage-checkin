import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Retour de Gersom le 02/09/2026 (voir le prompt complet dans l'historique) :
// - "on n'est pas capable de faire le placement de table avant d'approuver
//   (...) j'aimerais pouvoir cliquer tout de suite, voir c'est quoi les
//   tables disponibles, me la mettre la personne sur une table approuvée
//   (...) ça ouvre la demande et ça réserve déjà sa place (...) pour ne pas
//   qu'on fasse du double booking."
// - le systeme d'approbation "dit que l'approbation a déjà été traitée"
//   meme au premier appui -- durcissement du garde anti double-tap.
// - push iPhone "à configurer" -- infra deja complete (push_subscriptions,
//   notifyGuestApprovalReviewers/Placeurs), il ne manquait que les cles
//   VAPID cote Vercel (aucun changement de code necessaire).

const reservationMigration = readFileSync(
  new URL('../supabase/migrations/0044_guest_approval_pre_approval_reservation.sql', import.meta.url),
  'utf8'
);
const autoAssignMigration = readFileSync(
  new URL('../supabase/migrations/0045_auto_assign_table_for_guest_approval.sql', import.meta.url),
  'utf8'
);
const decideLibSource = readFileSync(new URL('../lib/guestApprovalDecide.ts', import.meta.url), 'utf8');
const reserveRouteSource = readFileSync(new URL('../app/api/guest-approvals/[id]/reserve-table/route.ts', import.meta.url), 'utf8');
const listRouteSource = readFileSync(new URL('../app/api/guest-approvals/route.ts', import.meta.url), 'utf8');
const assignPageSource = readFileSync(new URL('../app/approbations/[id]/assign/page.tsx', import.meta.url), 'utf8');
const approbationsPageSource = readFileSync(new URL('../app/approbations/page.tsx', import.meta.url), 'utf8');
const typesSource = readFileSync(new URL('../lib/types.ts', import.meta.url), 'utf8');

test('reserve_table_for_guest_approval refuse toute demande pas en_attente ou deja assignee, et compte les autres reservations en attente pour ne jamais double-booker', () => {
  assert.match(reservationMigration, /alter table guest_approval_requests add column if not exists reserved_table_id uuid references tables\(id\)/);
  assert.match(reservationMigration, /create or replace function reserve_table_for_guest_approval/);
  assert.match(reservationMigration, /if v_req\.statut <> 'en_attente' then raise exception 'request_not_pending'/);
  assert.match(reservationMigration, /if v_req\.table_id is not null then raise exception 'request_already_assigned'/);
  // La garantie anti double booking : compte les AUTRES demandes encore en
  // attente deja reservees sur la meme table, en plus des invitations et
  // excedents reels -- deux demandes en attente ne peuvent jamais se
  // reserver les memes places.
  assert.match(reservationMigration, /where reserved_table_id = p_table_id and statut = 'en_attente' and id <> p_request_id/);
  assert.match(reservationMigration, /if v_occupancy \+ v_req\.nombre_invites > v_table\.capacity then\s*\n\s*raise exception 'target_capacity_exceeded'/);
  assert.match(reservationMigration, /create or replace function release_guest_approval_reservation/);
});

test("la reservation ne cree jamais d'invitation -- seule l'approbation la finalise en vraie assignation (RPC 0038 reutilisee), le refus la libere", () => {
  // Reutilise EXACTEMENT le meme RPC atomique que l'assignation manuelle
  // post-approbation (0038) au lieu d'en dupliquer la logique de capacite.
  assert.match(decideLibSource, /if \(decision === 'approuve' && updated\.reserved_table_id && !updated\.table_id\)/);
  assert.match(decideLibSource, /supabase\.rpc\('assign_table_to_guest_approval_strict', \{/);
  assert.match(decideLibSource, /p_table_id: updated\.reserved_table_id/);
  assert.match(decideLibSource, /else if \(decision === 'refuse' && updated\.reserved_table_id\)/);
  assert.match(decideLibSource, /supabase\.rpc\('release_guest_approval_reservation', \{/);
  // La notification aux placeurs recoit desormais le vrai numero de table
  // quand une reservation vient d'etre finalisee (avant : toujours null a
  // la decision, seule l'assignation manuelle plus tard portait le numero).
  assert.match(decideLibSource, /notifyGuestApprovalPlaceurs\(supabase, updated, tableNumber\)/);
});

test("l'agent qui decide dans l'application est transmis pour attribuer correctement la finalisation automatique", () => {
  assert.match(decideLibSource, /decidedByAgentId\?: string/);
  assert.match(decideLibSource, /p_agent_id: decidedByAgentId \?\? null/);
});

test('la route reserve-table exige assignGuestApproval (memes roles que l\'assignation post-approbation), et un table_id null libere au lieu de reserver', () => {
  assert.match(reserveRouteSource, /hasCapability\(user\.role, ['"]assignGuestApproval['"]\)/);
  assert.match(reserveRouteSource, /reserve_table_for_guest_approval/);
  assert.match(reserveRouteSource, /release_guest_approval_reservation/);
  assert.match(reserveRouteSource, /tableId\s*\n\s*\? await supabase/);
});

test('la liste des demandes expose la table reservee (distincte de la table assignee) pour l\'affichage', () => {
  assert.match(listRouteSource, /reserved_table_id, /);
  assert.match(listRouteSource, /reserved_table:reserved_table_id\(number\)/);
  assert.match(listRouteSource, /reserved_table_number: row\.reserved_table\?\.number \?\? null/);
  assert.match(typesSource, /reserved_table_id: string \| null/);
});

test("l'ecran d'assignation a deux modes selon le statut : reserver (en_attente) ou assigner (approuve), sans reorganisation pour une demande pas encore decidee", () => {
  assert.match(assignPageSource, /const mode: 'assign' \| 'reserve' = request\?\.statut === 'en_attente' \? 'reserve' : 'assign'/);
  assert.match(assignPageSource, /found\.statut === 'approuve' \|\| found\.statut === 'en_attente'/);
  assert.match(assignPageSource, /reserve-table/);
  assert.match(assignPageSource, /assign-table/);
  // Pas de bloc de reorganisation (deplacer des invites deja assis) en mode
  // reservation -- trop tot pour une demande pas encore approuvee.
  assert.match(assignPageSource, /mode === 'assign' && chosenTableId && shortage > 0/);
  assert.match(assignPageSource, /mode === 'reserve' && chosenTableId && shortage > 0/);
  assert.match(assignPageSource, /RÉSERVER CETTE TABLE/);
  assert.match(assignPageSource, /ASSIGNER CETTE TABLE/);
});

test("l'approbation place automatiquement (retour de Gersom le 02/09/2026 : \"je n'ai pas besoin de voir reserver une table directement... etre capable de approuver ou refuser rapidement\") -- la carte de liste a un Approuver/Refuser direct, plus de lien de reservation manuelle", () => {
  assert.match(approbationsPageSource, /r\.statut === 'en_attente' && role && hasCapability\(role, 'reviewGuestApproval'\)/);
  assert.match(approbationsPageSource, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); void decide\(r\.id, 'approuve'\); \}\}/);
  assert.match(approbationsPageSource, /onClick=\{\(event\) => \{ event\.stopPropagation\(\); void decide\(r\.id, 'refuse'\); \}\}/);
  assert.doesNotMatch(approbationsPageSource, /Réserver une table/);
  assert.doesNotMatch(approbationsPageSource, /réservée — modifier/);
  assert.match(approbationsPageSource, /function placementLabel/);
  assert.doesNotMatch(approbationsPageSource, /reserved_table_number\s*\n\s*\? `En attente/);
});

test("auto_assign_table_for_guest_approval place la table excedentaire en priorite, puis la table la plus libre du meme cote, puis l'autre cote, jamais de double booking silencieux", () => {
  assert.match(autoAssignMigration, /create or replace function auto_assign_table_for_guest_approval/);
  assert.match(autoAssignMigration, /if v_req\.statut <> 'approuve' then raise exception 'request_not_approved'/);
  assert.match(autoAssignMigration, /if v_req\.table_id is not null then raise exception 'request_already_assigned'/);
  // Priorite 1 : table de reserve, quel que soit le cote.
  assert.match(autoAssignMigration, /where t\.event_id = v_req\.event_id and t\.is_reserve/);
  // Priorite 2 : sinon, la table la plus libre -- meme cote d'abord.
  assert.match(autoAssignMigration, /order by candidates\.meme_cote desc, candidates\.libres desc, candidates\.number/);
  // Priorite 3 : aucune place nulle part -- jamais d'exception, juste pas de table.
  assert.match(autoAssignMigration, /if v_table_id is null then\s*\n\s*return null;/);
  assert.match(autoAssignMigration, /security invoker set search_path = public, pg_temp/);
});

test('finalizeDecision appelle le placement automatique a l\'approbation quand aucune reservation n\'a ete posee, jamais si une table est deja assignee', () => {
  assert.match(decideLibSource, /else if \(decision === 'approuve' && !updated\.table_id\)/);
  assert.match(decideLibSource, /supabase\.rpc\('auto_assign_table_for_guest_approval', \{/);
  assert.match(decideLibSource, /p_request_id: updated\.id,\s*\n\s*p_agent_id: decidedByAgentId \?\? null,\s*\n\s*\}\);\s*\n\s*if \(!autoAssignError && assigned\)/);
});

test('le double-tap sur Approuver/Refuser est bloque par une garde synchrone (ref), pas seulement par le state React qui peut retarder d\'un rendu', () => {
  assert.match(approbationsPageSource, /const decidingRef = useRef<string \| null>\(null\)/);
  assert.match(approbationsPageSource, /if \(decidingRef\.current\) return;/);
  assert.match(approbationsPageSource, /decidingRef\.current = id;/);
  assert.match(approbationsPageSource, /decidingRef\.current = null;/);
});

test('le message "deja traitee" reflete le vrai statut actuel renvoye par le serveur au lieu d\'un texte generique', () => {
  assert.match(approbationsPageSource, /data\?\.statut === 'approuve' \|\| data\?\.statut === 'refuse'/);
  assert.match(approbationsPageSource, /maintenant Approuvée/);
  assert.match(approbationsPageSource, /maintenant Refusée/);
});

test("le tableau de bord est resserre pour que tout (jusqu'a la reserve/Table 41) tienne sans avoir a scroller", () => {
  const dashboardSource = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  // Corrige le 02/09/2026 (retour de Gersom) : le pb-10 precedent ne visait
  // que la derniere carte, mais l'empilement complet restait trop haut --
  // resserre partout (espacements, grilles, cartes) plutot qu'un simple
  // padding de bas de page.
  assert.match(dashboardSource, /className="flex-1 space-y-4 overflow-y-auto px-4 pt-3 pb-6"/);
  assert.match(dashboardSource, /className="grid grid-cols-2 gap-2">/);
});

test("/scan n'a plus de bouton \"Prendre une photo\" redondant sous la camera (le gros bouton central suffit)", () => {
  const scanPageSource = readFileSync(new URL('../app/scan/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(scanPageSource, />Prendre une photo</);
  assert.doesNotMatch(scanPageSource, /CameraIcon/);
  // captureGuestPhoto reste declenche par BottomNav (bouton central).
  assert.match(scanPageSource, /onCentralAction=\{hasCapability\(role, 'submitGuestApproval'\) \? captureGuestPhoto : undefined\}/);
});

test('le theme "verre liquide" (demande de Gersom le 02/09/2026 : "je veux que tout soit vraiment bien flottant... que ça l\'air d\'une application faite par Apple") est applique aux surfaces partagees, dans les deux themes, pas seulement en Maison', () => {
  const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  // .card utilisait shadow-card (var(--elev-1), litteralement "none" en
  // Maison -- aucune ombre du tout) et un flou reserve a dark: -- corrige :
  // var(--elev-2) + flou/saturation dans les deux themes, comme la barre du
  // bas et le dock de selection.
  const cardBlock = cssSource.slice(cssSource.indexOf('.card {'), cssSource.indexOf('.card {') + 400);
  assert.match(cardBlock, /box-shadow: var\(--elev-2\), inset 0 1px 0 rgba\(255, 255, 255, 0\.2\);/);
  assert.match(cardBlock, /backdrop-filter: blur\(20px\) saturate\(160%\);/);
  assert.doesNotMatch(cardBlock, /shadow-card/);
  // .action-row/.action-row-muted/.btn-secondary reprennent la meme recette
  // -- "vraiment partout", pas seulement une carte isolee.
  assert.match(cssSource, /\.action-row \{[\s\S]{0,300}?backdrop-filter: blur\(16px\) saturate\(160%\);/);
  assert.match(cssSource, /\.btn-secondary \{[\s\S]{0,300}?backdrop-filter: blur\(20px\) saturate\(160%\);/);
  // Boutons Approuver/Refuser en verre teinte (couleur en filtre translucide,
  // jamais un aplat plein) -- reference explicite Centre de controle iOS.
  assert.match(cssSource, /\.glass-pill-complete \{/);
  assert.match(cssSource, /\.glass-pill-over \{/);
  assert.match(cssSource, /color-mix\(in srgb, var\(--status-complete\) 18%, var\(--glass\)\)/);
});

test("le menu du compte affiche un badge persistant sur l'avatar (pas seulement dans le menu deroulant) pour les approbations en attente", () => {
  const accountMenuSource = readFileSync(new URL('../components/AccountMenu.tsx', import.meta.url), 'utf8');
  assert.match(accountMenuSource, /className="relative flex h-11 w-11/);
  assert.match(accountMenuSource, /\{canGuestApproval && pendingApprovals > 0 && \(/);
  assert.match(accountMenuSource, /absolute -right-1 -top-1/);
});
