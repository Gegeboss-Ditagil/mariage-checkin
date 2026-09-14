import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migration = readFileSync(
  new URL('../supabase/migrations/0024_initialize_members_adjust_prevu.sql', import.meta.url),
  'utf8'
);
const initializeRoute = readFileSync(
  new URL('../app/api/members/initialize/route.ts', import.meta.url),
  'utf8'
);

test('initialiser une liste plus courte reduit nombre_prevu sans jamais le faire grandir', () => {
  assert.match(migration, /if v_member_count < v_original_prevu then/);
  assert.match(migration, /update invitations set nombre_prevu = v_new_prevu, statut = v_statut/);
  assert.doesNotMatch(migration, /if v_member_count > v_original_prevu then/);
});

test('le correctif reste atomique et audite l avant et l apres', () => {
  assert.match(migration, /for update/);
  assert.match(migration, /'nombre_prevu_avant', v_original_prevu/);
  assert.match(migration, /'nombre_prevu_apres', v_inv\.nombre_prevu/);
  assert.match(migration, /'nombre_prevu_ajuste', v_was_adjusted/);
});

test('la route d initialisation utilise la capacite centrale manageMembers', () => {
  assert.match(initializeRoute, /hasCapability\(user\.role, 'manageMembers'\)/);
  assert.doesNotMatch(initializeRoute, /\['admin', 'directeur', 'placeur', 'agent_checkin'\]/);
});

const renameMigration = readFileSync(
  new URL('../supabase/migrations/0053_rename_member_syncs_solo_display_name.sql', import.meta.url),
  'utf8'
);
const renameRoute = readFileSync(new URL('../app/api/members/rename/route.ts', import.meta.url), 'utf8');

test('renommer un membre fait suivre le nom du haut UNIQUEMENT pour une invitation solo (14/09/2026)', () => {
  // Retour de Gersom (capture d'ecran) : "le nom de l'invitation aussi en
  // haut doit suivre la correction". Un groupe garde son libelle propre
  // ("Famille X") -- jamais ecrase par le nom d'un seul de ses membres.
  assert.match(renameMigration, /select count\(\*\) into v_member_count from invitation_guests where invitation_id = v_invitation_id;/);
  assert.match(renameMigration, /if v_member_count = 1 then/);
  assert.match(renameMigration, /update invitations set nom_affichage = v_guest\.nom_affichage where id = v_invitation_id;/);
});

test('la route de renommage d un membre reste reservee a manageMembers (agent_checkin exclu depuis le 14\\/09\\/2026)', () => {
  assert.match(renameRoute, /hasCapability\(user\.role, 'manageMembers'\)/);
  assert.doesNotMatch(renameRoute, /agent_checkin/);
});
