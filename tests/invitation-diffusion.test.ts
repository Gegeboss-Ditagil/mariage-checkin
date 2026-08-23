import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_INVITATION_MESSAGE,
  autoMapDiffusionHeaders,
  invitationLink,
  parseDiffusionRows,
  renderInvitationMessage,
  whatsappLink,
} from '../lib/invitationDiffusion.ts';

test('genere uniquement les liens Canva depuis un code F/T explicite et valide', () => {
  assert.equal(invitationLink('T010'), 'https://libalz.my.canva.site/vol-t010');
  assert.equal(invitationLink('vol-f004'), 'https://libalz.my.canva.site/vol-f004');
  assert.equal(invitationLink('10'), null);
  assert.equal(invitationLink('T10'), null);
});

test('associe les en-tetes usuels sans confondre email et nom', () => {
  const mapping = autoMapDiffusionHeaders(['Famille', 'Phone number', 'E-mail', 'Code vol', 'Nombre prévu']);
  assert.deepEqual(mapping, {
    famille: 'Famille',
    telephone: 'Phone number',
    email: 'E-mail',
    code_invitation: 'Code vol',
    nombre_personnes: 'Nombre prévu',
  });
});

test('valide les coordonnees et ne devine jamais un code depuis une table', () => {
  const contacts = parseDiffusionRows(
    [{ Famille: 'Famille Dos', Téléphone: '+1 416 555 1234', Code: 'T010', Nombre: '3' }, { Famille: 'Martin', Code: '4' }],
    { famille: 'Famille', telephone: 'Téléphone', code_invitation: 'Code', nombre_personnes: 'Nombre' }
  );
  assert.equal(contacts[0].nombrePersonnes, 3);
  assert.deepEqual(contacts[0].erreurs, []);
  assert.ok(contacts[1].erreurs.includes('Code attendu : T010 ou F004'));
  assert.ok(contacts[1].erreurs.includes('Téléphone et email manquants'));
});

test('personnalise le message et encode correctement le lien WhatsApp', () => {
  const contact = parseDiffusionRows(
    [{ Famille: 'Famille Dos', Téléphone: '+1 (416) 555-1234', Code: 'T010', Nombre: 2 }],
    { famille: 'Famille', telephone: 'Téléphone', code_invitation: 'Code', nombre_personnes: 'Nombre' }
  )[0];
  const message = renderInvitationMessage(DEFAULT_INVITATION_MESSAGE, contact);
  assert.match(message, /Bonjour Famille Dos/);
  assert.match(message, /https:\/\/libalz\.my\.canva\.site\/vol-t010/);
  assert.match(message, /2 personne/);
  assert.match(whatsappLink(contact, message) || '', /^https:\/\/wa\.me\/14165551234\?text=/);
});

test('la page traite le fichier localement sans API ni stockage persistant', () => {
  const source = readFileSync(new URL('../app/admin/diffusion/page.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.match(source, /XLSX\.read\(await file\.arrayBuffer\(\)/);
  assert.match(source, /aucune coordonnée n'est envoyée à Supabase/i);
});
