import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessPath, hasCapability, landingPathForRole } from '../lib/permissions.ts';
import type { Role } from '../lib/types.ts';

const roles: Role[] = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];

test('destination apres connexion par role', () => {
  assert.equal(landingPathForRole('admin'), '/scan');
  assert.equal(landingPathForRole('directeur'), '/dashboard');
  assert.equal(landingPathForRole('placeur'), '/scan');
  assert.equal(landingPathForRole('agent_checkin'), '/scan');
  assert.equal(landingPathForRole('visibilite'), '/dashboard');
});

test('tous les roles ont une matrice explicite', () => {
  for (const role of roles) assert.equal(typeof hasCapability(role, 'viewTables'), 'boolean');
});

test('les cinq roles consultent le staff selon leurs droits de check-in', () => {
  for (const role of roles) assert.equal(canAccessPath(role, '/staff'), true);
  for (const role of ['admin', 'directeur', 'placeur', 'agent_checkin'] as const) {
    assert.equal(hasCapability(role, 'checkin'), true);
  }
  assert.equal(hasCapability('visibilite', 'checkin'), false);
});

test('agent scan peut consulter et faire le check-in sans deplacer', () => {
  assert.equal(hasCapability('agent_checkin', 'scan'), true);
  assert.equal(hasCapability('agent_checkin', 'checkin'), true);
  assert.equal(hasCapability('agent_checkin', 'assignOverflow'), true);
  assert.equal(hasCapability('agent_checkin', 'moveGuests'), false);
  assert.equal(hasCapability('agent_checkin', 'manageOverflow'), false);
  assert.equal(canAccessPath('agent_checkin', '/table/abc'), true);
  assert.equal(canAccessPath('agent_checkin', '/plan-table'), true);
  assert.equal(canAccessPath('agent_checkin', '/staff'), true);
  assert.equal(canAccessPath('agent_checkin', '/tables/move/abc'), false);
  assert.equal(canAccessPath('agent_checkin', '/placement'), false);
});

test('visibilite reste strictement en lecture seule', () => {
  assert.equal(hasCapability('visibilite', 'viewDashboard'), true);
  assert.equal(hasCapability('visibilite', 'viewTables'), true);
  assert.equal(hasCapability('visibilite', 'search'), true);
  assert.equal(hasCapability('visibilite', 'scan'), false);
  assert.equal(hasCapability('visibilite', 'checkin'), false);
  assert.equal(canAccessPath('visibilite', '/dashboard'), true);
  assert.equal(canAccessPath('visibilite', '/tables/abc'), true);
  assert.equal(canAccessPath('visibilite', '/plan-table'), true);
  assert.equal(canAccessPath('visibilite', '/staff'), true);
  assert.equal(canAccessPath('visibilite', '/search'), true);
  assert.equal(canAccessPath('visibilite', '/scan'), false);
  assert.equal(canAccessPath('visibilite', '/placement'), false);
  assert.equal(canAccessPath('visibilite', '/checkin/abc'), false);
});

test('directeur et placeur ont les memes droits operationnels', () => {
  for (const capability of ['scan', 'checkin', 'placement', 'moveGuests', 'manageOverflow', 'addInvitation'] as const) {
    assert.equal(hasCapability('directeur', capability), true);
    assert.equal(hasCapability('placeur', capability), true);
  }
  assert.equal(hasCapability('directeur', 'adminPanel'), false);
  assert.equal(hasCapability('placeur', 'adminPanel'), false);
  assert.equal(hasCapability('directeur', 'exportData'), false);
  assert.equal(hasCapability('placeur', 'exportData'), false);
});

test('admin conserve tous les droits sensibles', () => {
  assert.equal(hasCapability('admin', 'adminPanel'), true);
  assert.equal(hasCapability('admin', 'exportData'), true);
  assert.equal(canAccessPath('admin', '/admin/users'), true);
});

test("le chemin racine n'autorise pas implicitement toutes les pages", () => {
  assert.equal(canAccessPath('visibilite', '/admin'), false);
  assert.equal(canAccessPath('agent_checkin', '/admin'), false);
});

