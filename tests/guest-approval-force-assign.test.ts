import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const assignPage = readFileSync(new URL('../app/approbations/[id]/assign/page.tsx', import.meta.url), 'utf8');
const assignRoute = readFileSync(new URL('../app/api/guest-approvals/[id]/assign-table/route.ts', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../supabase/migrations/0049_force_assign_guest_approval.sql', import.meta.url), 'utf8');

// v1.41.0, retour de Gersom le 03/09/2026 : « quand j'approuve un invité et
// qu'il n'y a plus de place, je ne peux pas choisir la table ». L'écran
// n'affichait que les tables avec assez de places libres et le RPC refusait
// tout dépassement — l'invité approuvé restait sans place quand l'événement
// était complet.

test('l’écran d’assignation propose le forçage quand aucune table n’a de place', () => {
  // La liste des recommandations bascule en « toutes les tables » quand force
  // est actif, au lieu de rester vide (aucune table choisisable).
  assert.match(assignPage, /filter\(\(usage\) => force \|\| usage\.libresEstimees >= needed\)/);
  // Le toggle n'apparaît qu'en mode assign (une demande en_attente réserve
  // sans créer d'invitation : rien à forcer avant l'approbation).
  assert.match(assignPage, /mode === 'assign' && \(\s*\n\s*<>\s*\n\s*<p className="text-sm text-text-muted">\s*\n\s*Vous pouvez quand même forcer le placement/);
  // Le bouton de validation est utilisable en mode forcé même sans
  // réorganisation complète (relocationReady n'est plus bloquant).
  assert.match(assignPage, /mode === 'assign' && force \? false : !relocationReady/);
  // L'erreur cible renvoie explicitement vers le toggle.
  assert.match(assignPage, /target_capacity_exceeded'\)\s*\n\s*\? 'Table pleine — activez « Forcer le placement »/);
});

test('l’API transmet bien p_force au RPC strict', () => {
  assert.match(assignRoute, /const force = body\.force === true;/);
  assert.match(assignRoute, /p_force: force,/);
});

test('la migration 0049 rend le forçage possible sans casser le comportement strict', () => {
  // Nouveau paramètre avec défaut false : les appels existants (finalisation
  // d'une réservation 0044 à l'approbation, lib/guestApprovalDecide.ts) gardent
  // exactement le comportement 0038.
  assert.match(migration, /p_relocations jsonb default '\[\]'::jsonb,\s*\n\s*p_force boolean default false/);
  // Le contrôle de capacité cible ne s'applique qu'en comportement strict.
  assert.match(migration, /if not coalesce\(p_force, false\)\s*\n\s*and v_target_occupancy - v_moved_from_target \+ v_req\.nombre_invites > v_table\.capacity then\s*\n\s*raise exception 'target_capacity_exceeded';/);
  // Les destinations d'une réorganisation restent strictes même en forcé.
  assert.match(migration, /raise exception 'destination_capacity_exceeded';/);
  // Les arrivés ne sont jamais déplacés.
  assert.match(migration, /raise exception 'arrived_guest_cannot_move';/);
  // Le forçage est tracé dans l'audit pour rester réconciliable avec la
  // capacité officielle.
  assert.match(migration, /'force', coalesce\(p_force, false\)/);
});
