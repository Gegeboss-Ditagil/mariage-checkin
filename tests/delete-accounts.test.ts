import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canDeleteAccount, hasCapability } from '../lib/permissions.ts';
import type { Role } from '../lib/types.ts';

const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const ROLES: Role[] = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];

// v1.86.0 : supprimer un compte, réservé aux admins.

test('deleteAccounts : admin seulement', () => {
  for (const role of ROLES) assert.equal(hasCapability(role, 'deleteAccounts'), role === 'admin', role);
});

test('canDeleteAccount : jamais soi-même, jamais l’admin principal, un admin seulement par l’admin principal', () => {
  const admin = { id: 'a', role: 'admin' as Role };
  const superAdmin = { id: 's', role: 'admin' as Role, is_super_admin: true };
  assert.equal(canDeleteAccount(admin, { id: 'p', role: 'placeur' }), true);
  assert.equal(canDeleteAccount(admin, { id: 'a', role: 'admin' }), false, 'soi-même');
  assert.equal(canDeleteAccount(admin, { id: 'x', role: 'admin' }), false, 'autre admin par un admin ordinaire');
  assert.equal(canDeleteAccount(superAdmin, { id: 'x', role: 'admin' }), true, 'autre admin par l’admin principal');
  assert.equal(canDeleteAccount(superAdmin, { id: 'z', role: 'admin', is_super_admin: true }), false, 'l’admin principal');
  assert.equal(canDeleteAccount({ id: 'd', role: 'directeur' }, { id: 'p', role: 'placeur' }), false, 'directeur');
});

test('API DELETE /api/admin/users : capacité, garde-fous et message pour les demandes liées', () => {
  const route = read('app/api/admin/users/route.ts');
  const del = route.slice(route.indexOf('export async function DELETE'));
  assert.match(del, /hasCapability\(user\.role, 'deleteAccounts'\)/);
  assert.match(del, /id === user\.id/);
  assert.match(del, /canDeleteAccount\(user,/);
  assert.match(del, /error\.code === '23503'[\s\S]*désactivez-le plutôt/);
  assert.match(del, /\.eq\('event_id', user\.event_id\)/);
  assert.match(route, /canDelete: canDeleteAccount\(user,/);
});

test('/admin/users : corbeille en verre avec confirmation, seulement quand le serveur l’autorise', () => {
  const page = read('app/admin/users/page.tsx');
  assert.match(page, /\{u\.canDelete && \(/);
  assert.match(page, /glass-icon-button glass-icon-button-sm text-status-over/);
  assert.match(page, /window\.confirm\(`Supprimer définitivement/);
  assert.match(page, /method: 'DELETE'/);
  assert.match(page, /finally \{\s*setDeletingId\(null\)/);
});
