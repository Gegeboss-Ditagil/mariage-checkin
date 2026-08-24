import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canAccessPath, hasCapability, landingPathForRole } from '../lib/permissions.ts';
import type { Role } from '../lib/types.ts';
import { isStaffWithoutTable } from '../lib/staffVisibility.ts';

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

test('staff est accessible a tous les roles operationnels, visibilite en lecture seule', () => {
  assert.equal(canAccessPath('admin', '/staff'), true);
  assert.equal(canAccessPath('directeur', '/staff'), true);
  assert.equal(canAccessPath('placeur', '/staff'), true);
  assert.equal(canAccessPath('agent_checkin', '/staff'), true);
  assert.equal(canAccessPath('visibilite', '/staff'), true);
  assert.equal(hasCapability('visibilite', 'checkin'), false);
  assert.equal(hasCapability('visibilite', 'checkin'), false);
});

test('la visibilite des lignes staff est restreinte selon le role', () => {
  for (const role of roles) assert.equal(hasCapability(role, 'viewStaff'), true);
  assert.equal(hasCapability('admin', 'viewAllStaff'), true);
  assert.equal(hasCapability('directeur', 'viewAllStaff'), true);
  assert.equal(hasCapability('visibilite', 'viewAllStaff'), true);
  assert.equal(hasCapability('placeur', 'viewAllStaff'), false);
  assert.equal(hasCapability('agent_checkin', 'viewAllStaff'), false);
  assert.equal(isStaffWithoutTable({ tags: ['Côté_Gege', 'no-table'] }), true);
  assert.equal(isStaffWithoutTable({ tags: ['SERVICES', 'T030'] }), false);
});

test('la page staff conserve le filtrage serveur et ne lit pas directement invitations', () => {
  const pageSource = readFileSync(new URL('../app/staff/page.tsx', import.meta.url), 'utf8');
  const apiSource = readFileSync(new URL('../app/api/staff/route.ts', import.meta.url), 'utf8');

  assert.match(pageSource, /fetch\(['"]\/api\/staff['"]/);
  assert.doesNotMatch(pageSource, /\.from\(['"]invitations['"]\)/);
  assert.doesNotMatch(pageSource, /createClient|postgres_changes/);
  assert.match(apiSource, /hasCapability\(user\.role, ['"]viewAllStaff['"]\)/);
  assert.match(apiSource, /staff\.filter\(isStaffWithoutTable\)/);
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

test('agent scan ne peut pas transferer ou echanger en lot', () => {
  // /tables/move-multiple et /api/move-invitations ne sont PAS couverts par
  // le prefixe '/tables/move' (pas de '/' juste apres) : verifie
  // explicitement pour ne pas regresser silencieusement si la logique de
  // matchesPrefix change un jour.
  assert.equal(canAccessPath('agent_checkin', '/tables/move-multiple'), false);
  assert.equal(canAccessPath('agent_checkin', '/api/move-invitations'), false);
  assert.equal(canAccessPath('agent_checkin', '/api/swap-invitations'), false);
});

test('agent scan ne peut pas fusionner deux invitations (mais peut renommer)', () => {
  assert.equal(canAccessPath('agent_checkin', '/api/invitations/merge'), false);
  // Renommer une invitation reste au meme niveau que gerer les membres :
  // pas de nouveau blocage pour ce role sur /api/invitations/rename.
  assert.equal(canAccessPath('agent_checkin', '/api/invitations/rename'), true);
});

test('agent scan ne peut pas gerer les etiquettes (mais garde le reste de manageMembers)', () => {
  // Retire le 23/08/2026 sur demande explicite de Gersom : ce role est la
  // pour scanner/checker, pas pour reclassifier les invites (cote, roles
  // staff, notable...). manageMembers (renommer, gerer les membres du
  // groupe) reste inchange pour ce role.
  assert.equal(hasCapability('agent_checkin', 'manageTags'), false);
  assert.equal(hasCapability('agent_checkin', 'manageMembers'), true);
  for (const role of ['admin', 'directeur', 'placeur'] as const) {
    assert.equal(hasCapability(role, 'manageTags'), true, role + ' doit garder manageTags');
  }
  assert.equal(hasCapability('visibilite', 'manageTags'), false);

  const tagsAddSource = readFileSync(new URL('../app/api/invitations/tags/add/route.ts', import.meta.url), 'utf8');
  const tagsRemoveSource = readFileSync(new URL('../app/api/invitations/tags/remove/route.ts', import.meta.url), 'utf8');
  const renameSource = readFileSync(new URL('../app/api/invitations/rename/route.ts', import.meta.url), 'utf8');
  const checkinPageSource = readFileSync(new URL('../app/checkin/[invitationId]/page.tsx', import.meta.url), 'utf8');
  for (const source of [tagsAddSource, tagsRemoveSource]) {
    assert.match(source, /hasCapability\(user\.role, ['"]manageTags['"]\)/);
    // Ne doit plus recreer de liste de roles locale (voir CLAUDE.md).
    assert.doesNotMatch(source, /agent_checkin/);
  }
  assert.match(renameSource, /hasCapability\(user\.role, ['"]manageMembers['"]\)/);
  assert.match(checkinPageSource, /const canManageTags = hasCapability\(role, ['"]manageTags['"]\)/);
  assert.match(checkinPageSource, /\{canManageTags && \(/);
});

test('le bouton d appel du staff est reserve a admin et directeur', () => {
  // Demande explicite de Gersom le 23/08/2026 : appeler le staff/les
  // prestataires est reserve au directeur de festin (et admin) -- les
  // autres roles n'ont pas besoin d'appeler.
  assert.equal(hasCapability('admin', 'callStaff'), true);
  assert.equal(hasCapability('directeur', 'callStaff'), true);
  for (const role of ['placeur', 'agent_checkin', 'visibilite'] as const) {
    assert.equal(hasCapability(role, 'callStaff'), false, role + ' ne doit pas avoir callStaff');
  }

  const staffPageSource = readFileSync(new URL('../app/staff/page.tsx', import.meta.url), 'utf8');
  const planTablePageSource = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');
  assert.match(staffPageSource, /const canCall = hasCapability\(role, ['"]callStaff['"]\)/);
  assert.match(staffPageSource, /\{canCall && inv\.telephone && \(/);
  assert.match(planTablePageSource, /const canCall = hasCapability\(role, ['"]callStaff['"]\)/);
  assert.match(planTablePageSource, /\{canCall && inv\.telephone && \(/);
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
  assert.equal(canAccessPath('admin', '/admin/diffusion'), true);
  for (const role of ['directeur', 'placeur', 'agent_checkin', 'visibilite'] as const) {
    assert.equal(canAccessPath(role, '/admin/diffusion'), false);
  }
});

test("le chemin racine n'autorise pas implicitement toutes les pages", () => {
  assert.equal(canAccessPath('visibilite', '/admin'), false);
  assert.equal(canAccessPath('agent_checkin', '/admin'), false);
});

