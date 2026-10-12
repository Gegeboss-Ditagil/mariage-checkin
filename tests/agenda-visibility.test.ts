import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { visibleAgendaItems } from '../lib/agendaVisibility.ts';
import { hasCapability } from '../lib/permissions.ts';
import type { Role } from '../lib/types.ts';

// Lignes représentatives du programme du 24/10/2026 (migrations 0077/0078).
const ITEMS = [
  { title: "Préparation de l'accueil", details: 'Contrôle des codes QR.', is_private: false },
  { title: 'Départ discret des mariés', details: "Autre sortie que le chapiteau. Préserver la surprise.", is_private: false },
  { title: "Départ vers l'aérodrome de Persan", details: 'Destination confidentielle.', is_private: true },
  { title: "Convoi VIP et accueil de la mariée à l'aérodrome", details: "Atterrissage de l'hélicoptère.", is_private: true },
  { title: 'Rassemblement des invités VIP', details: 'Sans révéler les détails de la surprise.', is_private: false },
];
const SECRET = /aérodrome|persan|hélicopt|atterriss/i;

test('agenda : un rôle sans manageAgenda ne reçoit jamais une ligne privée', () => {
  const roles: Role[] = ['admin', 'directeur', 'placeur', 'agent_checkin', 'visibilite'];
  for (const role of roles) {
    const visible = visibleAgendaItems(ITEMS, hasCapability(role, 'manageAgenda'));
    if (hasCapability(role, 'manageAgenda')) {
      assert.equal(visible.length, ITEMS.length, role);
    } else {
      assert.equal(visible.length, 3, role);
      for (const item of visible) assert.doesNotMatch(item.title + ' ' + item.details, SECRET, role + ' : ' + item.title);
    }
  }
});

test('agenda : GET /api/agenda filtre côté serveur via visibleAgendaItems, sans repli côté client', () => {
  const route = readFileSync(new URL('../app/api/agenda/route.ts', import.meta.url), 'utf8');
  assert.ok(route.includes('visibleAgendaItems(normalized, canManage)'));
  assert.ok(route.includes("hasCapability(user.role, 'manageAgenda')"));
});

test('agenda : seuls admin et directeur gèrent l\'agenda ; scanner, placeur et approbateur ne voient que le public', () => {
  assert.equal(hasCapability('admin', 'manageAgenda'), true);
  assert.equal(hasCapability('directeur', 'manageAgenda'), true);
  for (const role of ['placeur', 'agent_checkin', 'visibilite'] as Role[]) assert.equal(hasCapability(role, 'manageAgenda'), false, role);
});
