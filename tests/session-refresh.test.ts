import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileSession } from '../lib/sessionRefresh.ts';
import { canAccessPath, hasCapability } from '../lib/permissions.ts';
import type { Role, SessionUser } from '../lib/types.ts';

// v1.78.0 : un rôle changé par un admin s'applique dès la requête suivante,
// pour toutes les combinaisons de rôles ; un compte désactivé est déconnecté.

const ROLES: Role[] = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];
const session = (role: Role): SessionUser => ({ id: 'u1', nom_affichage: 'X', nom_complet: null, role, event_id: 'e1', is_super_admin: false });

test('changement de rôle : toutes les combinaisons (5 × 5)', () => {
  for (const from of ROLES) {
    for (const to of ROLES) {
      const decision = reconcileSession(session(from), { role: to, active: true, is_super_admin: false });
      if (from === to) {
        assert.equal(decision.kind, 'keep', `${from} -> ${to}`);
      } else if (from === 'admin' || to === 'admin') {
        // Le mode de connexion change (email + mot de passe / nom + PIN).
        assert.equal(decision.kind, 'revoke', `${from} -> ${to}`);
      } else {
        assert.equal(decision.kind, 'refresh', `${from} -> ${to}`);
        assert.equal(decision.kind === 'refresh' && decision.user.role, to);
      }
    }
  }
});

test('les droits suivent immédiatement le nouveau rôle (ex. placeur -> approbateur perd le check-in)', () => {
  const decision = reconcileSession(session('placeur'), { role: 'visibilite', active: true, is_super_admin: false });
  assert.equal(decision.kind, 'refresh');
  const role = decision.kind === 'refresh' ? decision.user.role : 'placeur';
  assert.equal(hasCapability(role, 'checkin'), false);
  assert.equal(canAccessPath(role, '/scan'), false);
  const promoted = reconcileSession(session('agent_checkin'), { role: 'directeur', active: true, is_super_admin: false });
  assert.equal(promoted.kind === 'refresh' && hasCapability(promoted.user.role, 'manageAgenda'), true);
});

test('compte désactivé ou supprimé : session révoquée, quel que soit le rôle', () => {
  for (const role of ROLES) {
    assert.equal(reconcileSession(session(role), { role, active: false, is_super_admin: false }).kind, 'revoke');
    assert.equal(reconcileSession(session(role), null).kind, 'revoke');
  }
});

test('base injoignable : on garde la session (jamais déconnecter tout le staff pendant une coupure)', () => {
  for (const role of ROLES) assert.equal(reconcileSession(session(role), undefined).kind, 'keep');
});

test('admin principal retiré ou donné : la session suit', () => {
  const d = reconcileSession({ ...session('admin'), is_super_admin: true }, { role: 'admin', active: true, is_super_admin: false });
  assert.equal(d.kind === 'refresh' && d.user.is_super_admin, false);
});
