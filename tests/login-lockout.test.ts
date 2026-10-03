import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MAX_FAILED_LOGIN_ATTEMPTS,
  LOGIN_LOCKOUT_DURATION_MS,
  isLockedOut,
  lockoutRemainingMinutes,
  nextStateAfterFailure,
  RESET_LOCKOUT_STATE,
} from '../lib/loginLockout.ts';

// v1.67.0, retour de Gersom (message vocal) : "rajouter un processus de
// sécurité pour ne pas qu'on puisse brute force les tentatives... maximum
// 10 tentatives de suite erronées... pour pas se faire pirater facilement,
// pour pas qu'il y ait quelqu'un qui nous sabote." Portée confirmée par
// compte (nom_affichage), jamais par IP (voir lib/loginLockout.ts). Durée de
// verrouillage (15 min) confirmée explicitement par Gersom via AskUserQuestion
// plutôt que devinée -- l'option retenue plutôt qu'un verrouillage permanent
// nécessitant une réinitialisation manuelle d'un admin/directeur.

test('MAX_FAILED_LOGIN_ATTEMPTS = 10, LOGIN_LOCKOUT_DURATION_MS = 15 minutes', () => {
  assert.equal(MAX_FAILED_LOGIN_ATTEMPTS, 10);
  assert.equal(LOGIN_LOCKOUT_DURATION_MS, 15 * 60 * 1000);
});

test('nextStateAfterFailure incrémente le compteur sans verrouiller avant la 10e tentative', () => {
  let state = { failed_login_attempts: 0, locked_until: null as string | null };
  for (let i = 1; i < MAX_FAILED_LOGIN_ATTEMPTS; i++) {
    const next = nextStateAfterFailure(state);
    assert.equal(next.failed_login_attempts, i);
    assert.equal(next.locked_until, null);
    assert.equal(next.justLocked, false);
    state = next;
  }
});

test('nextStateAfterFailure verrouille exactement à la 10e tentative consécutive, jamais avant ni après coup', () => {
  const state = { failed_login_attempts: MAX_FAILED_LOGIN_ATTEMPTS - 1, locked_until: null };
  const next = nextStateAfterFailure(state);
  assert.equal(next.failed_login_attempts, MAX_FAILED_LOGIN_ATTEMPTS);
  assert.equal(next.justLocked, true);
  assert.ok(next.locked_until, 'locked_until doit être posé');
  const lockedAt = new Date(next.locked_until!).getTime();
  const expected = Date.now() + LOGIN_LOCKOUT_DURATION_MS;
  assert.ok(Math.abs(lockedAt - expected) < 2000, 'locked_until doit être ~15 minutes dans le futur');
});

test('isLockedOut : vrai tant que locked_until est dans le futur, faux une fois expiré ou absent', () => {
  assert.equal(isLockedOut({ failed_login_attempts: 10, locked_until: new Date(Date.now() + 60000).toISOString() }), true);
  assert.equal(isLockedOut({ failed_login_attempts: 10, locked_until: new Date(Date.now() - 1000).toISOString() }), false);
  assert.equal(isLockedOut({ failed_login_attempts: 0, locked_until: null }), false);
});

test('un verrou déjà expiré remet le compteur à zéro -- une nouvelle tentative échouée après expiration ne reverrouille pas immédiatement', () => {
  const expiredLock = { failed_login_attempts: MAX_FAILED_LOGIN_ATTEMPTS, locked_until: new Date(Date.now() - 1000).toISOString() };
  assert.equal(isLockedOut(expiredLock), false, 'le verrou doit être considéré expiré');
  const next = nextStateAfterFailure(expiredLock);
  assert.equal(next.failed_login_attempts, 1, 'repart de 1, pas de 11 (jamais un reverrouillage immédiat après expiration)');
  assert.equal(next.justLocked, false);
});

test('lockoutRemainingMinutes arrondit toujours vers le haut (jamais "0 minute")', () => {
  assert.equal(lockoutRemainingMinutes({ failed_login_attempts: 10, locked_until: new Date(Date.now() + 30 * 1000).toISOString() }), 1);
  assert.equal(lockoutRemainingMinutes({ failed_login_attempts: 10, locked_until: new Date(Date.now() + 14.5 * 60000).toISOString() }), 15);
  assert.equal(lockoutRemainingMinutes({ failed_login_attempts: 0, locked_until: null }), 0);
});

test('RESET_LOCKOUT_STATE remet bien le compteur et le verrou à zéro/null', () => {
  assert.deepEqual(RESET_LOCKOUT_STATE, { failed_login_attempts: 0, locked_until: null });
});

const routeSource = readFileSync(new URL('../app/api/auth/login/route.ts', import.meta.url), 'utf8');

test('POST /api/auth/login applique le verrouillage AVANT de vérifier le secret, pour les deux modes (pin ET password)', () => {
  const modes = routeSource.split(/if \(body\.mode === /).slice(1);
  assert.equal(modes.length, 2, 'les deux branches mode doivent exister');
  for (const block of modes) {
    assert.match(block, /if \(user && isLockedOut\(user\)\) \{\s*\n\s*return lockedResponse\(user\);/);
  }
});

test('POST /api/auth/login enregistre une tentative échouée sur un secret incorrect, et réinitialise le verrou sur une connexion réussie', () => {
  assert.match(routeSource, /if \(user\) await recordFailedAttempt\(supabase, user, user\.nom_affichage\);/g);
  assert.match(routeSource, /if \(user\.failed_login_attempts > 0 \|\| user\.locked_until\) \{\s*\n\s*await supabase\.from\('users'\)\.update\(RESET_LOCKOUT_STATE\)\.eq\('id', user\.id\);/);
});

test('un verrouillage déclenché (justLocked) est journalisé via logServerEvent (visibilité pour Gersom sur /admin/logs en cas de sabotage réel)', () => {
  assert.match(routeSource, /import \{ logServerEvent \} from '@\/lib\/serverLog';/);
  assert.match(routeSource, /if \(next\.justLocked\) \{\s*\n\s*void logServerEvent\(\{/);
  assert.match(routeSource, /level: 'warn'/);
});

test('le message au client ne révèle jamais le nombre de tentatives restantes avant verrouillage (seulement une fois verrouillé)', () => {
  const lockedBlock = routeSource.slice(routeSource.indexOf('function lockedResponse'), routeSource.indexOf('async function recordFailedAttempt'));
  assert.match(lockedBlock, /Trop de tentatives échouées/);
  assert.match(lockedBlock, /status: 423/);
});
