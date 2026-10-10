import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { canAccessPath, hasCapability, landingPathForRole } from '../lib/permissions.ts';
import type { Role } from '../lib/types.ts';

// v1.75.0, demande de Gersom : « reconsidère tes tests... surtout sur une
// première utilisation pour tous les rôles ». Deux bugs de « première fois »
// ont échappé aux tests : le scanneur qui ouvrait une invitation jamais
// ouverte retombait sur l'ancien compteur (v1.73.1), et l'Approbateur
// (visibilite) qui touchait un invité dans « Tous les invités » était renvoyé
// au tableau de bord sans explication (trouvé par CE test, corrigé en v1.75.0).
//
// Principe : pour chaque rôle, tout ce qu'un nouvel utilisateur voit et
// touche lors de sa première session doit mener à une page qu'il a le droit
// d'ouvrir, et chaque action d'une page doit être gardée par la capacité
// que l'API exigera.

const ROLES: Role[] = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

test('première connexion : la page d’arrivée et le choix du thème sont accessibles à chaque rôle', () => {
  const middleware = read('middleware.ts');
  assert.match(middleware, /if \(pathname\.startsWith\('\/onboarding'\)\)/);
  for (const role of ROLES) {
    const landing = landingPathForRole(role);
    assert.ok(canAccessPath(role, landing), `${role} : page d'arrivée ${landing} interdite`);
    if (landing === '/scan') assert.ok(hasCapability(role, 'scan'), `${role} arrive sur /scan sans la capacité scan`);
  }
});

// Onglets de la barre du bas par rôle, toutes pages confondues (barre
// générique + variantes de /dashboard, /scan et /agenda). Vérifiés contre la
// source de components/BottomNav.tsx ci-dessous pour rester synchronisés.
const NAV_HREFS: Record<Role, string[]> = {
  admin: ['/search', '/plan-table', '/dashboard', '/scan', '/approbations', '/agenda'],
  directeur: ['/search', '/plan-table', '/dashboard', '/scan', '/approbations', '/agenda'],
  placeur: ['/search', '/plan-table', '/dashboard', '/scan', '/approbations', '/agenda'],
  agent_checkin: ['/search', '/plan-table', '/dashboard', '/agenda', '/approbations', '/scan'],
  visibilite: ['/dashboard', '/plan-table', '/search', '/approbations'],
};

test('barre du bas : chaque onglet montré à un rôle ouvre une page qu’il a le droit de voir', () => {
  const nav = read('components/BottomNav.tsx');
  assert.match(nav, /const DIRECTOR_STYLE_ITEMS: NavItem\[\] = \[SEARCH_ITEM, PLAN_ITEM, DASHBOARD_ITEM, SCAN_ITEM, APPROVALS_ITEM\];/);
  assert.match(nav, /const isDirectorStyleNav = role === 'admin' \|\| role === 'directeur' \|\| role === 'placeur' \|\| role === 'agent_checkin';/);
  for (const role of ROLES) {
    for (const href of NAV_HREFS[role]) {
      assert.ok(canAccessPath(role, href), `${role} voit l'onglet ${href} mais n'y a pas accès`);
    }
  }
});

test('menu du compte : chaque lien n’est montré qu’aux rôles qui peuvent l’ouvrir', () => {
  const menu = read('components/AccountMenu.tsx');
  assert.match(menu, /href="\/mon-mot-de-passe"/);
  assert.match(menu, /\{canHistory && <Link role="menuitem" href="\/history"/);
  assert.match(menu, /\{canManagePasswords && <Link role="menuitem" href="\/mots-de-passe"/);
  assert.match(menu, /\{canAdmin && <Link role="menuitem" href="\/admin"/);
  for (const role of ROLES) {
    assert.ok(canAccessPath(role, '/mon-mot-de-passe'), `${role} : /mon-mot-de-passe interdit`);
    if (hasCapability(role, 'viewGuestApprovals')) assert.ok(canAccessPath(role, '/approbations'), role);
    if (hasCapability(role, 'managePasswords')) assert.ok(canAccessPath(role, '/mots-de-passe'), role);
    if (hasCapability(role, 'adminPanel')) assert.ok(canAccessPath(role, '/admin'), role);
  }
});

test('première ouverture d’une invitation : tout rôle qui peut ouvrir la fiche crée les lignes nominatives', () => {
  for (const role of ROLES) {
    if (!canAccessPath(role, '/checkin/abc')) continue;
    // Sinon : ancien compteur +/- au lieu de « Qui est arrivé ? » (v1.73.1).
    assert.ok(hasCapability(role, 'checkin'), `${role} ouvre /checkin sans pouvoir créer les lignes nominatives`);
  }
  assert.match(read('app/api/members/ensure/route.ts'), /hasCapability\(user\.role, 'checkin'\)/);
  assert.match(read('app/api/members/initialize/route.ts'), /hasCapability\(user\.role, 'checkin'\)/);
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return files(full);
    return entry.endsWith('.tsx') ? [full] : [];
  });
}

// Écrans qui mènent à /checkin et dont l'accès est déjà réservé à des rôles
// ayant tous la capacité checkin (vérifié dans le test).
const CHECKIN_ONLY_SCREENS: Record<string, keyof typeof CAPABILITY_FOR_SCREEN> = {
  'app/tables/add/page.tsx': '/tables/add',
  'app/tables/move-guest/[guestId]/page.tsx': '/tables/move-guest',
};
const CAPABILITY_FOR_SCREEN = { '/tables/add': 'addInvitation', '/tables/move-guest': 'moveGuests' } as const;

test('aucun écran n’envoie un rôle sans accès vers /checkin (bug trouvé : « Tous les invités » pour l’Approbateur)', () => {
  const offenders: string[] = [];
  for (const file of files(join(ROOT, 'app'))) {
    const rel = file.slice(ROOT.length).replace(/\\/g, '/').replace(/^\//, '');
    if (rel.startsWith('app/checkin/')) continue;
    const source = readFileSync(file, 'utf8');
    if (!/['"`]\/checkin\//.test(source)) continue;
    const screen = CHECKIN_ONLY_SCREENS[rel];
    if (screen) {
      for (const role of ROLES) {
        if (canAccessPath(role, screen)) assert.ok(hasCapability(role, 'checkin'), `${role} ouvre ${screen} sans checkin`);
      }
      continue;
    }
    const guarded = /hasCapability\([^)]*'checkin'\)/.test(source) || /canCheckin|readOnly/.test(source);
    if (!guarded) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], 'liens vers /checkin sans garde de capacité');
  // Les deux corrections de v1.75.0, explicitement.
  assert.match(read('app/dashboard/liste/page.tsx'), /disabled=\{!canCheckin\}/);
  assert.match(read('app/approbations/[id]/assign/page.tsx'), /mode === 'assign' && hasCapability\(role, 'checkin'\)/);
});

test('chaque rôle qui voit Approbations reçoit un badge qu’il a le droit de lire', () => {
  for (const role of ROLES) {
    if (NAV_HREFS[role].includes('/approbations')) {
      assert.ok(hasCapability(role, 'viewGuestApprovals'), `${role} voit l'onglet Approbations sans viewGuestApprovals`);
    }
  }
});

test('écrans d’écriture : ouverts seulement aux rôles que l’API acceptera', () => {
  const screens: [string, Parameters<typeof hasCapability>[1]][] = [
    ['/tables/add', 'addInvitation'],
    ['/tables/move/x', 'moveGuests'],
    ['/tables/overflow/x', 'manageOverflow'],
    ['/mots-de-passe', 'managePasswords'],
    ['/agenda', 'viewAgenda'],
  ];
  for (const role of ROLES) {
    for (const [path, capability] of screens) {
      if (canAccessPath(role, path)) assert.ok(hasCapability(role, capability), `${role} ouvre ${path} sans ${capability}`);
    }
  }
});

// Balayage complet : pour chaque écran et chaque rôle qui peut l'ouvrir, tout
// lien littéral (href, push, replace, backHref) doit mener à une page permise
// à ce rôle -- OU être masqué par une capacité que ce rôle n'a pas (liste
// ci-dessous, vérifiée). Un nouveau lien non gardé fait échouer le test.
const HIDDEN_BY_CAPABILITY: Record<string, Parameters<typeof hasCapability>[1]> = {
  '/checkin': 'checkin',
  '/tables/overflow': 'moveGuests',
  '/tables/move': 'moveGuests',
  '/tables/move-multiple': 'moveGuests',
};

test('aucun lien d’un écran ne mène un rôle vers une page qu’il ne peut pas ouvrir', () => {
  const problems: string[] = [];
  for (const file of files(join(ROOT, 'app')).filter((f) => f.endsWith('page.tsx'))) {
    const route = '/' + file.slice(join(ROOT, 'app').length + 1).replace(/\\/g, '/').replace(/\/?page\.tsx$/, '').replace(/\[[^\]]+\]/g, 'x');
    const source = readFileSync(file, 'utf8');
    const targets = new Set(
      Array.from(source.matchAll(/(?:href=\{?|push\(|replace\(|backHref=\{?)\s*['"`](\/[a-z][a-z0-9\-/]*)/g)).map((m) => m[1].replace(/\/$/, ''))
    );
    for (const role of ROLES) {
      if (role === 'admin' || !canAccessPath(role, route)) continue;
      for (const target of targets) {
        if (target.startsWith('/api') || target.startsWith('/login') || canAccessPath(role, target + (target.endsWith('/') ? 'x' : ''))) continue;
        const capability = HIDDEN_BY_CAPABILITY[target];
        if (capability && !hasCapability(role, capability)) continue;
        problems.push(`${role} : ${route} -> ${target}`);
      }
    }
  }
  assert.deepEqual(problems, []);
  // Correction v1.75.0 : retour de /approbations vers la page d'arrivée du rôle.
  assert.match(read('app/approbations/page.tsx'), /const approvalsBackHref = role \? landingPathForRole\(role\) : '\/scan';/);
});
