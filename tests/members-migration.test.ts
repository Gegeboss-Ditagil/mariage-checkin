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

