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

test("la fiche d'approbation propose de reserver une table (ou de la modifier) pendant que la demande est encore en attente, sans attendre l'approbation", () => {
  assert.match(approbationsPageSource, /statut === 'en_attente' && role && hasCapability\(role, 'assignGuestApproval'\)/);
  assert.match(approbationsPageSource, /Réserver une table/);
  assert.match(approbationsPageSource, /réservée — modifier/);
  assert.match(approbationsPageSource, /En attente — Table \$\{request\.reserved_table_number\} réservée/);
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

test("le tableau de bord laisse assez d'espace en bas (Table 41 etait coupee, obligeant a scroller un peu)", () => {
  const dashboardSource = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  assert.match(dashboardSource, /className="flex-1 space-y-6 overflow-y-auto px-4 pt-4 pb-10"/);
});

test("/scan n'a plus de bouton \"Prendre une photo\" redondant sous la camera (le gros bouton central suffit)", () => {
  const scanPageSource = readFileSync(new URL('../app/scan/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(scanPageSource, />Prendre une photo</);
  assert.doesNotMatch(scanPageSource, /CameraIcon/);
  // captureGuestPhoto reste declenche par BottomNav (bouton central).
  assert.match(scanPageSource, /onCentralAction=\{hasCapability\(role, 'submitGuestApproval'\) \? captureGuestPhoto : undefined\}/);
});

test("le menu du compte affiche un badge persistant sur l'avatar (pas seulement dans le menu deroulant) pour les approbations en attente", () => {
  const accountMenuSource = readFileSync(new URL('../components/AccountMenu.tsx', import.meta.url), 'utf8');
  assert.match(accountMenuSource, /className="relative flex h-11 w-11/);
  assert.match(accountMenuSource, /\{canGuestApproval && pendingApprovals > 0 && \(/);
  assert.match(accountMenuSource, /absolute -right-1 -top-1/);
});
