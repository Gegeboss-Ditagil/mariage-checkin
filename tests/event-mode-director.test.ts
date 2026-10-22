import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { canAccessPath, hasCapability } from '../lib/permissions.ts';
import type { Role } from '../lib/types.ts';

const ROLES: Role[] = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];
const read = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// v1.85.0 : le directeur de festin change le mode de l'événement et
// réinitialise les données de test, sans toucher au reste de l'administration.

test('manageEventMode : admin et directeur seulement', () => {
  for (const role of ROLES) {
    assert.equal(hasCapability(role, 'manageEventMode'), role === 'admin' || role === 'directeur', role);
  }
});

test('/admin s’ouvre au directeur, jamais ses sous-pages ni les autres rôles', () => {
  assert.ok(canAccessPath('directeur', '/admin'));
  for (const sub of ['/admin/logs', '/admin/import-withjoy', '/admin/wizard', '/admin/tables', '/admin/exports']) {
    assert.equal(canAccessPath('directeur', sub), false, sub);
  }
  for (const role of ['placeur', 'agent_checkin', 'visibilite'] as Role[]) {
    assert.equal(canAccessPath(role, '/admin'), false, role);
  }
});

test('API : le statut est ouvert à manageEventMode, tout autre champ reste adminPanel', () => {
  const route = read('app/api/admin/event/route.ts');
  assert.match(route, /hasCapability\(user\.role, 'manageEventMode'\)/);
  assert.match(route, /Object\.keys\(body\)\.every\(\(key\) => key === 'status'\)/);
  assert.match(route, /!onlyStatus && !hasCapability\(user\.role, 'adminPanel'\)/);
});

test('API : la réinitialisation exige manageEventMode et reste refusée en mode live par la base', () => {
  const route = read('app/api/admin/reset-test-data/route.ts');
  assert.match(route, /hasCapability\(user\.role, 'manageEventMode'\)/);
  assert.match(route, /event_live/);
});

test('page /admin : le directeur ne voit que le mode et la réinitialisation', () => {
  const page = read('app/admin/page.tsx');
  assert.match(page, /isAdmin = hasCapability\(viewerRole, 'adminPanel'\)/);
  const gated = page.slice(page.indexOf('{isAdmin && ('), page.indexOf('RÉINITIALISER') > 0 ? page.indexOf('<p className="mb-2 font-semibold">Mode test</p>') : 0);
  for (const marker of ['href="/admin/logs"', 'toggleTwilio', 'Santé de la base']) {
    assert.ok(gated.includes(marker), `${marker} doit rester dans le bloc réservé à l’admin`);
  }
  assert.match(page, /<BottomNav role=\{viewerRole\} \/>/);
});

test('menu du compte : lien « Mode de l’événement » pour le directeur seulement', () => {
  const menu = read('components/AccountMenu.tsx');
  assert.match(menu, /canEventMode = hasCapability\(role, 'manageEventMode'\) && !canAdmin/);
  assert.match(menu, /\{canEventMode && <Link role="menuitem" href="\/admin"/);
});
