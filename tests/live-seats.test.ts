import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import {
  buildLiveSeats,
  floorPlanChairs,
  invitationPeopleNames,
  liveSeatNames,
  overflowPlaceholder,
  seatIndicesForInvitation,
  tablePeopleNames,
  type LiveSeatGuest,
  type LiveSeatInvitation,
} from '../lib/liveSeats.ts';
import { TABLE_SEAT_NAMES } from '../lib/floorPlanSeats.ts';

// v1.74.0, retour de Gersom (capture de la table 1, tous les sièges
// « Vide ») : une personne placée par l'application en table 1/42 (invité
// surprise, excédent) doit apparaître par son nom sur le dessin de la table,
// et le dessin doit suivre la liste d'invités.

const inv = (id: string, nom: string, extra: Partial<LiveSeatInvitation> = {}): LiveSeatInvitation => ({
  id,
  nom_affichage: nom,
  notes: null,
  nombre_prevu: 1,
  nombre_arrive: 0,
  ne_viendra_pas: false,
  ...extra,
});
const guest = (nom: string, extra: Partial<LiveSeatGuest> = {}): LiveSeatGuest => ({
  nom_affichage: nom,
  arrival_status: 'attendu',
  is_unplanned: false,
  created_at: '2026-10-10T10:00:00Z',
  ...extra,
});

test('table 1 (réserve, vide sur le PDF) : un invité surprise approuvé apparaît sur un siège', () => {
  const surprise = inv('s1', 'Sergio', { notes: 'Invité surprise approuvé (placement automatique)' });
  const people = tablePeopleNames({
    tableInvitationIds: ['s1'],
    invitationsById: new Map([['s1', surprise]]),
    guestsByInvitation: new Map(),
    overflow: [],
    incomingOverflowIds: new Set(),
  });
  const seats = buildLiveSeats(1, people, 10);
  assert.equal(seats.length, 10);
  assert.deepEqual(liveSeatNames(seats).filter(Boolean), ['Sergio']);
  assert.deepEqual(seatIndicesForInvitation(seats, 's1'), [0]);
});

test('table 42 : un excédent envoyé en réserve est assis sous le nom de la personne ajoutée sur place', () => {
  const famille = inv('f1', 'Famille Makongo', { table_id: 't30', nombre_prevu: 2, nombre_arrive: 3 } as Partial<LiveSeatInvitation>);
  const guests = new Map([
    ['f1', [
      guest('Roger Makongo', { arrival_status: 'arrive', created_at: '2026-10-10T10:00:00Z' }),
      guest('Rose Makongo', { arrival_status: 'arrive', created_at: '2026-10-10T10:01:00Z' }),
      guest('Paul Ajouté', { arrival_status: 'arrive', is_unplanned: true, created_at: '2026-10-10T10:02:00Z' }),
    ]],
  ]);
  const overflow = [{ id: 'o1', invitation_id: 'f1', nombre_personnes: 1, created_at: '2026-10-10T10:03:00Z' }];
  const reserve = tablePeopleNames({
    tableInvitationIds: [],
    invitationsById: new Map([['f1', famille]]),
    guestsByInvitation: guests,
    overflow,
    incomingOverflowIds: new Set(['o1']),
  });
  assert.deepEqual(reserve.map((p) => p.name), ['Paul Ajouté']);
  assert.deepEqual(liveSeatNames(buildLiveSeats(42, reserve, 10)).filter(Boolean), ['Paul Ajouté']);

  // À la table d'origine, la personne partie en réserve n'est plus dessinée.
  const origin = tablePeopleNames({
    tableInvitationIds: ['f1'],
    invitationsById: new Map([['f1', famille]]),
    guestsByInvitation: guests,
    overflow,
    incomingOverflowIds: new Set(),
  });
  assert.deepEqual(origin.map((p) => p.name), ['Roger Makongo', 'Rose Makongo']);
});

test("excédent sans nom connu : libellé « Excédent · <invitation> », jamais un nom inventé", () => {
  const famille = inv('f2', 'Famille Vemba', { nombre_prevu: 2, nombre_arrive: 3 });
  const people = tablePeopleNames({
    tableInvitationIds: [],
    invitationsById: new Map([['f2', famille]]),
    guestsByInvitation: new Map(),
    overflow: [{ id: 'o2', invitation_id: 'f2', nombre_personnes: 1, created_at: '2026-10-10T10:00:00Z' }],
    incomingOverflowIds: new Set(['o2']),
  });
  assert.deepEqual(people.map((p) => p.name), [overflowPlaceholder('Famille Vemba')]);
});

test('le PDF garde l’ordre des personnes toujours là, libère les absents, place les nouveaux sur les sièges libres', () => {
  const photographed = TABLE_SEAT_NAMES[2];
  const firstName = photographed.find((n): n is string => !!n)!;
  const people = [
    { name: 'Nouvelle Personne', invitationId: 'n1' },
    { name: firstName, invitationId: 'a1' },
  ];
  const seats = buildLiveSeats(2, people, 10);
  const idx = photographed.indexOf(firstName);
  assert.equal(seats[idx]?.name, firstName, 'une personne toujours placée reste sur son siège du PDF');
  // Toutes les autres personnes du PDF ne sont plus à cette table : sièges libérés.
  assert.equal(liveSeatNames(seats).filter(Boolean).length, 2);
  assert.ok(liveSeatNames(seats).includes('Nouvelle Personne'));
});

test('table qui déborde : des sièges sont ajoutés au lieu de cacher quelqu’un', () => {
  const people = Array.from({ length: 12 }, (_, i) => ({ name: 'P' + i, invitationId: 'x' }));
  assert.equal(buildLiveSeats(42, people, 10).length, 12);
});

test('invitation : « ne viendra pas » libère ses sièges ; lignes en trop limitées à nombre_prevu', () => {
  assert.deepEqual(invitationPeopleNames(inv('a', 'Sergio', { nombre_prevu: 0 }), [guest('Sergio', { arrival_status: 'ne_viendra_pas' })]), []);
  assert.deepEqual(invitationPeopleNames(inv('b', 'X', { ne_viendra_pas: true }), undefined), []);
  // Famille Malungu en production : 5 lignes pour nombre_prevu = 2 -> les 2 de « Membres: ».
  const malungu = inv('c', 'Famille Malungu', { nombre_prevu: 2, notes: 'Membres: Ruben Kinanga Malungu, Maguy Malungu' });
  const rows = ['Sister 2 Malungu', 'Ruben Kinanga Malungu', 'Maguy Malungu', 'Sister 1 Malungu', 'Keziah Malungu'].map((n, i) =>
    guest(n, { created_at: '2026-10-10T10:0' + i + ':00Z' })
  );
  assert.deepEqual(invitationPeopleNames(malungu, rows), ['Ruben Kinanga Malungu', 'Maguy Malungu']);
  // Sans lignes ni membres : complété par « Invité de … », jamais un nom deviné.
  assert.deepEqual(invitationPeopleNames(inv('d', 'Famille Z', { nombre_prevu: 2 }), undefined), ['Famille Z', 'Invité de Famille Z']);
});

test('chaises du grand plan : suivent le nombre réel de personnes placées', () => {
  assert.deepEqual(floorPlanChairs([null, null, null], 0), [false, false, false]);
  assert.deepEqual(floorPlanChairs([null, null, null], 2), [true, true, false]);
  assert.deepEqual(floorPlanChairs(['A', null, 'B'], 1), [true, false, false]);
  assert.deepEqual(floorPlanChairs(['A', 'B'], 3), [true, true, true]);
  assert.deepEqual(floorPlanChairs(['A', null], undefined), [true, false]);
});

test('les 4 écrans utilisent les sièges vivants, en temps réel', () => {
  const hook = readFileSync(new URL('../hooks/useLiveTableSeats.ts', import.meta.url), 'utf8');
  for (const t of ['invitations', 'overflow_assignments', 'invitation_guests', 'guests']) {
    assert.match(hook, new RegExp("table: '" + t + "'"), 'abonnement temps réel ' + t);
  }
  for (const file of ['app/plan-table/page.tsx', 'app/tables/[tableId]/page.tsx', 'app/table/[tableId]/page.tsx', 'components/GuestArrivalPanel.tsx']) {
    const source = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(source, /useLiveTableSeats\(/, file);
    assert.doesNotMatch(source, /TABLE_SEAT_NAMES/, file + ' ne doit plus lire l’export figé directement');
  }
  const plan = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');
  assert.match(plan, /occupiedSeatsByNumber=\{occupiedSeatsByNumber\}/);
  assert.match(plan, /table: 'overflow_assignments' \}, debouncedLoad\)/);
});
