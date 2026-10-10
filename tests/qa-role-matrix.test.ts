import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { canAccessPath, canResetPassword, hasCapability, landingPathForRole, ROLE_CAPABILITIES, type Capability } from '../lib/permissions.ts';
import type { Role } from '../lib/types.ts';

// v1.72.1 -- processus QA demandé par Gersom : « fais des cas de test précis
// basés sur toutes les business rules de l'app, avec chacun des types
// d'utilisateurs (placeurs, scanneurs, directeurs de festin, visibilité) ».
// Matrice attendue écrite ICI à la main (pas recopiée du code), à partir de
// docs/BUSINESS_RULES.md (tableau des rôles, corrigé dans ce même lot) et des
// décisions datées de Gersom. Toute évolution de droits doit modifier ce
// test ET la doc dans le même lot.

const ROLES: Role[] = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];
const Y = true;
const N = false;

// [admin, directeur, placeur, agent_checkin (scanneur), visibilite]
const EXPECTED: Record<Capability, [boolean, boolean, boolean, boolean, boolean]> = {
  scan: [Y, Y, Y, Y, N],
  search: [Y, Y, Y, Y, Y],
  viewDashboard: [Y, Y, Y, Y, Y],
  viewTables: [Y, Y, Y, Y, Y],
  viewStaff: [Y, Y, Y, Y, Y],
  viewAllStaff: [Y, Y, N, N, Y],
  checkin: [Y, Y, Y, Y, N],
  placement: [Y, Y, Y, N, N],
  moveGuests: [Y, Y, Y, N, N],
  mergeInvitations: [Y, N, N, N, N],
  assignOverflow: [Y, Y, Y, Y, N],
  manageOverflow: [Y, Y, Y, N, N],
  manageMembers: [Y, Y, Y, N, N], // scanneur : plus de renommage depuis le 14/09/2026
  manageTags: [Y, Y, N, N, N], // v1.30.1 : admin et directeur uniquement
  callStaff: [Y, Y, N, N, N],
  messageContacts: [Y, N, N, N, N],
  contactGuests: [Y, Y, N, N, N], // v1.69.0
  markNoShow: [Y, Y, Y, Y, N],
  addInvitation: [Y, Y, N, N, N], // directeur depuis le 02/09/2026
  viewHistory: [Y, N, N, N, N], // admin seul depuis le 30/08/2026
  resolveExceptions: [Y, Y, Y, Y, N],
  viewGuestApprovals: [Y, Y, Y, Y, Y],
  viewAgenda: [Y, Y, Y, Y, N], // placeur depuis le 14/09, scanneur depuis le 03/09
  manageAgenda: [Y, Y, N, N, N],
  submitGuestApproval: [Y, Y, Y, N, N], // le scanneur renvoie vers un placeur
  reviewGuestApproval: [Y, Y, N, N, Y], // le placeur ne décide jamais
  assignGuestApproval: [Y, Y, Y, N, Y],
  deleteGuestApproval: [Y, Y, Y, N, N], // v1.57.0
  exportData: [Y, N, N, N, N],
  adminPanel: [Y, N, N, N, N],
  managePasswords: [Y, Y, N, N, N],
};

test('QA rôles : chaque rôle a exactement les capacités attendues (aucune en trop, aucune en moins)', () => {
  for (const [capability, row] of Object.entries(EXPECTED) as [Capability, boolean[]][]) {
    ROLES.forEach((role, index) => {
      assert.equal(hasCapability(role, capability), row[index], `${role} / ${capability} : attendu ${row[index] ? 'Oui' : 'Non'}`);
    });
  }
  // Aucune capacité inconnue de cette matrice (une nouvelle capacité doit y entrer).
  for (const role of ROLES) {
    for (const capability of ROLE_CAPABILITIES[role]) {
      assert.ok(capability in EXPECTED, `capacité ${capability} absente de la matrice QA`);
    }
  }
  assert.equal(hasCapability(null, 'scan'), false, 'jamais de droit sans session');
});

test('QA rôles : écran d arrivée après connexion', () => {
  assert.equal(landingPathForRole('admin'), '/scan');
  assert.equal(landingPathForRole('directeur'), '/dashboard');
  assert.equal(landingPathForRole('placeur'), '/scan');
  assert.equal(landingPathForRole('agent_checkin'), '/scan');
  assert.equal(landingPathForRole('visibilite'), '/dashboard');
});

// [admin, directeur, placeur, agent_checkin, visibilite]
const PATHS: Record<string, [boolean, boolean, boolean, boolean, boolean]> = {
  '/scan': [Y, Y, Y, Y, N],
  '/search': [Y, Y, Y, Y, Y],
  '/dashboard': [Y, Y, Y, Y, Y],
  '/dashboard/liste': [Y, Y, Y, Y, Y],
  '/plan-table': [Y, Y, Y, Y, Y],
  '/tables/abc': [Y, Y, Y, Y, Y],
  '/table/abc': [Y, Y, Y, Y, N],
  '/staff': [Y, Y, Y, Y, Y],
  '/checkin/abc': [Y, Y, Y, Y, N],
  '/checkin/abc/members': [Y, Y, Y, Y, N],
  '/exceptions': [Y, Y, Y, Y, N],
  '/placement': [Y, Y, Y, N, N],
  '/approbations': [Y, Y, Y, Y, Y],
  '/approbations/abc/assign': [Y, Y, Y, Y, Y],
  '/agenda': [Y, Y, Y, Y, N],
  '/history': [Y, N, N, N, N],
  '/mots-de-passe': [Y, Y, N, N, N],
  '/mon-mot-de-passe': [Y, Y, Y, Y, Y],
  '/tables/add': [Y, Y, N, N, N], // addInvitation
  '/tables/move-guest/abc': [Y, Y, Y, N, N],
  '/tables/move/abc': [Y, Y, Y, N, N], // moveGuests
  '/tables/move-multiple': [Y, Y, Y, N, N],
  '/tables/overflow/abc': [Y, Y, Y, N, N], // manageOverflow
  '/admin': [Y, N, N, N, N],
  '/admin/users': [Y, N, N, N, N],
  '/admin/import-withjoy': [Y, N, N, N, N],
  '/admin/exports': [Y, N, N, N, N],
  '/': [Y, Y, Y, Y, Y],
};

test('QA rôles : accès aux écrans (middleware) pour chaque rôle', () => {
  for (const [path, row] of Object.entries(PATHS)) {
    ROLES.forEach((role, index) => {
      assert.equal(canAccessPath(role, path), row[index], `${role} -> ${path} : attendu ${row[index] ? 'autorisé' : 'refusé'}`);
    });
  }
});

test('QA rôles : réinitialiser le mot de passe d autrui (jamais un admin, sauf admin principal)', () => {
  assert.equal(canResetPassword({ role: 'directeur' }, 'placeur'), true);
  assert.equal(canResetPassword({ role: 'directeur' }, 'admin'), false);
  assert.equal(canResetPassword({ role: 'admin' }, 'admin'), false);
  assert.equal(canResetPassword({ role: 'admin', is_super_admin: true }, 'admin'), true);
  assert.equal(canResetPassword({ role: 'placeur' }, 'agent_checkin'), false);
  assert.equal(canResetPassword({ role: 'visibilite' }, 'agent_checkin'), false);
});

// Chaque route API d'écriture vérifie la BONNE capacité (filet serveur :
// l'interface ne suffit jamais), via lib/permissions -- jamais une liste de
// rôles recopiée (règle CLAUDE.md, corrigé en v1.72.1 sur 10 routes).
const API_CAPABILITY: Record<string, Capability[]> = {
  'agenda': ['viewAgenda', 'manageAgenda'],
  'checkin': ['checkin'],
  'checkin/cancel': ['checkin'],
  'checkin/correct': ['checkin'],
  'exceptions': ['resolveExceptions'],
  'exceptions/[id]/resolve': ['resolveExceptions'],
  'export': ['exportData'],
  'guest-approvals': ['viewGuestApprovals', 'submitGuestApproval'],
  'guest-approvals/[id]': ['deleteGuestApproval'],
  'guest-approvals/[id]/assign-table': ['assignGuestApproval'],
  'guest-approvals/[id]/decide': ['reviewGuestApproval'],
  'guest-approvals/[id]/reserve-table': ['assignGuestApproval'],
  'history': ['viewHistory'],
  'invitations/add': ['addInvitation'],
  'invitations/merge': ['mergeInvitations'],
  'invitations/no-show': ['markNoShow'],
  'invitations/rename': ['manageMembers'],
  'invitations/tags/add': ['manageTags'],
  'invitations/tags/remove': ['manageTags'],
  'members/add': ['manageMembers'],
  'members/add-unplanned': ['submitGuestApproval'],
  'members/ensure': ['checkin'],
  'members/initialize': ['checkin'],
  'members/move': ['moveGuests'],
  'members/remove': ['manageMembers'],
  'members/rename': ['manageMembers'],
  'members/set-arrival-status': ['checkin'],
  'move-invitation': ['moveGuests'],
  'move-invitations': ['moveGuests'],
  'swap-invitations': ['moveGuests'],
  'overflow/assign': ['assignOverflow'],
  'overflow/move': ['manageOverflow'],
  'overflow/unassign': ['manageOverflow'],
  'passwords': ['managePasswords'],
  'staff': ['viewStaff', 'viewAllStaff'],
};

test('QA API : chaque route vérifie la capacité attendue, sans liste de rôles recopiée', () => {
  for (const [route, capabilities] of Object.entries(API_CAPABILITY)) {
    const source = readFileSync(new URL(`../app/api/${route}/route.ts`, import.meta.url), 'utf8');
    for (const capability of capabilities) {
      assert.match(source, new RegExp(`hasCapability\\([^)]*'${capability}'\\)`), `${route} doit vérifier ${capability}`);
    }
    assert.doesNotMatch(source, /\[\s*'admin',\s*'directeur'/, `${route} : liste de rôles recopiée`);
  }
});

test('QA API : toute route non publique exige une session (getSessionUser)', () => {
  const root = new URL('../app/api/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : name === 'route.ts' ? [full] : [];
    });
  const routes = walk(root).map((file) => file.slice(root.length).replace(/\\/g, '/'));
  assert.ok(routes.length >= 50);
  for (const route of routes) {
    if (route.startsWith('public/') || route.startsWith('auth/')) continue;
    const source = readFileSync(join(root, route), 'utf8');
    assert.match(source, /getSessionUser\(\)/, `${route} doit exiger une session`);
  }
});

test('QA réseau : la page hors ligne est publique et le cache du service worker est renouvelé', () => {
  const middleware = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
  assert.match(middleware, /const PUBLIC_PATHS = \[[^\]]*'\/offline'[^\]]*\];/);
  const sw = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  assert.match(sw, /const CACHE_NAME = 'checkin-shell-v4';/);
  assert.match(sw, /const APP_SHELL = \[[^\]]*'\/offline'/);
});
