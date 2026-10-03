import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canAccessPath, canResetPassword, canViewPasswordHint, hasCapability } from '../lib/permissions.ts';
import { generateRandomPin, maskPinForHint } from '../lib/passwordReset.ts';
import type { Role } from '../lib/types.ts';

// v1.65.0, retour de Gersom (message vocal, 03/10/2026) : "l'admin
// principal... peut changer les mots de passe... et même voir les mots de
// passe [avec anonymisation]... les directeurs de festin... peuvent faire
// la réinitialisation... sauf aux admins. Les admins peuvent faire la même
// chose et... réinitialiser les mots de passe des directeurs de festin. Et
// l'admin principal... peut le faire pour tout le monde... la seule
// personne qui a de la visibilité sur tout... c'est Gersom." Confirmé
// explicitement par Gersom : le compte "admin principal" est "Admin"
// (gersomdos@gmail.com), son compte perso "Dos" reste un admin normal.

const roles: Role[] = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];

test('managePasswords : seuls admin et directeur ont la capacité de base', () => {
  assert.equal(hasCapability('admin', 'managePasswords'), true);
  assert.equal(hasCapability('directeur', 'managePasswords'), true);
  assert.equal(hasCapability('placeur', 'managePasswords'), false);
  assert.equal(hasCapability('agent_checkin', 'managePasswords'), false);
  assert.equal(hasCapability('visibilite', 'managePasswords'), false);
});

test('canResetPassword : un admin ou directeur normal peut réinitialiser tout le monde sauf un admin', () => {
  const targets: Role[] = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];
  for (const actorRole of ['admin', 'directeur'] as const) {
    for (const targetRole of targets) {
      const expected = targetRole !== 'admin';
      assert.equal(
        canResetPassword({ role: actorRole, is_super_admin: false }, targetRole),
        expected,
        `${actorRole} -> ${targetRole} attendu ${expected}`
      );
    }
  }
});

test("canResetPassword : le compte admin principal (is_super_admin) peut réinitialiser n'importe qui, y compris un autre admin", () => {
  for (const targetRole of roles) {
    assert.equal(canResetPassword({ role: 'admin', is_super_admin: true }, targetRole), true);
  }
});

test('canResetPassword : un rôle sans managePasswords (placeur, agent scanner, approbateur) ne peut jamais réinitialiser personne, même pas être super admin ne le lui donnerait pas sans managePasswords', () => {
  for (const actorRole of ['placeur', 'agent_checkin', 'visibilite'] as const) {
    for (const targetRole of roles) {
      assert.equal(canResetPassword({ role: actorRole, is_super_admin: false }, targetRole), false);
    }
  }
});

test("canViewPasswordHint : réservé au compte is_super_admin, jamais à un admin/directeur ordinaire", () => {
  assert.equal(canViewPasswordHint({ is_super_admin: true }), true);
  assert.equal(canViewPasswordHint({ is_super_admin: false }), false);
  assert.equal(canViewPasswordHint({}), false);
});

test("canAccessPath('/mots-de-passe') : admin et directeur seulement", () => {
  assert.equal(canAccessPath('admin', '/mots-de-passe'), true);
  assert.equal(canAccessPath('directeur', '/mots-de-passe'), true);
  assert.equal(canAccessPath('placeur', '/mots-de-passe'), false);
  assert.equal(canAccessPath('agent_checkin', '/mots-de-passe'), false);
  assert.equal(canAccessPath('visibilite', '/mots-de-passe'), false);
});

test('generateRandomPin : toujours 4 chiffres, avec des zéros de tête', () => {
  for (let i = 0; i < 200; i++) {
    const pin = generateRandomPin();
    assert.equal(pin.length, 4);
    assert.match(pin, /^\d{4}$/);
  }
});

test('maskPinForHint : masque tout sauf les deux derniers caractères', () => {
  assert.equal(maskPinForHint('1234'), '**34');
  assert.equal(maskPinForHint('0007'), '**07');
});

test('maskPinForHint : ne plante jamais sur une entrée trop courte (filet, jamais produit en pratique par generateRandomPin)', () => {
  assert.equal(maskPinForHint('7'), '7');
  assert.equal(maskPinForHint(''), '');
});

const routeSource = readFileSync(new URL('../app/api/passwords/route.ts', import.meta.url), 'utf8');

test("GET /api/passwords exige managePasswords, et ne renvoie l'indice (hint) que si canViewPasswordHint est vrai -- jamais un masquage cote client", () => {
  assert.match(routeSource, /hasCapability\(user\.role, 'managePasswords'\)/);
  assert.match(routeSource, /const canViewHints = canViewPasswordHint\(user\)/);
  assert.match(routeSource, /hint: canViewHints \? row\.pin_reset_hint : undefined/);
  assert.match(routeSource, /canReset: canResetPassword\(user, row\.role\)/);
});

test('POST /api/passwords revérifie canResetPassword côté serveur (jamais une confiance aveugle dans ce que le client a affiché)', () => {
  const postBlock = routeSource.slice(routeSource.indexOf('export async function POST'));
  assert.match(postBlock, /if \(!canResetPassword\(user, target\.role\)\)/);
  assert.match(postBlock, /status: 403/);
});

test('le PIN généré ne part jamais vers les logs serveur en clair -- seulement qui a réinitialisé le compte de qui', () => {
  const postBlock = routeSource.slice(routeSource.indexOf('export async function POST'));
  const logStart = postBlock.indexOf('logServerEvent');
  const logCall = postBlock.slice(logStart, postBlock.indexOf('});', logStart) + 3);
  assert.doesNotMatch(logCall, /\bpin\b(?!_hash|_reset_hint)/);
  assert.match(logCall, /actorId: user\.id/);
  assert.match(logCall, /targetId: target\.id/);
});

const loginSource = readFileSync(new URL('../app/login/page.tsx', import.meta.url), 'utf8');

test('/login propose "Mot de passe oublié ?" qui révèle un texte statique, sans appel réseau', () => {
  assert.match(loginSource, /Mot de passe oublié \?/);
  assert.match(loginSource, /Allez voir les directeurs de festin\. Ils vous donneront un nouveau mot de passe\./);
  // Purement informatif : jamais de fetch déclenché par ce bouton.
  const buttonBlock = loginSource.slice(loginSource.indexOf('Mot de passe oublié'), loginSource.indexOf('Mot de passe oublié') + 600);
  assert.doesNotMatch(buttonBlock, /fetch\(/);
});

const authSource = readFileSync(new URL('../lib/auth.ts', import.meta.url), 'utf8');

test('is_super_admin est bien porté par le jeton de session (jamais lu ailleurs que depuis la session signée)', () => {
  assert.match(authSource, /is_super_admin: payload\.is_super_admin === true/);
});
