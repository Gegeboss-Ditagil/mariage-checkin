import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// GuestArrivalPanel.tsx et le checkin melangent JSX et TS : meme convention
// que les autres tests de ce dossier (voir floor-plan.test.ts) --
// inspection du code source plutot qu'import direct dans node:test.
const panelSource = readFileSync(new URL('../components/GuestArrivalPanel.tsx', import.meta.url), 'utf8');
const checkinSource = readFileSync(new URL('../app/checkin/[invitationId]/page.tsx', import.meta.url), 'utf8');
const migrationSource = readFileSync(
  new URL('../supabase/migrations/0029_guest_arrival_status.sql', import.meta.url),
  'utf8'
);
const arrivalRouteSource = readFileSync(
  new URL('../app/api/members/set-arrival-status/route.ts', import.meta.url),
  'utf8'
);

test("la route d'arrivee utilise la capacite checkin centralisee", () => {
  assert.match(arrivalRouteSource, /hasCapability\(user\.role, 'checkin'\)/);
  assert.doesNotMatch(arrivalRouteSource, /\['admin', 'directeur', 'placeur', 'agent_checkin'\]/);
});

test('remplace le compteur agrege par un etat par personne, jamais de nombre "arrivees" sans savoir qui', () => {
  // Demande de Gersom le 29/08/2026 sur un groupe de 5 : "on ne veut pas
  // savoir le nombre de personnes, on veut savoir c'est qui".
  assert.match(panelSource, /guests\.arrival_status/);
  assert.doesNotMatch(panelSource, /CounterStepper/);
});

test('un guest "ne_viendra_pas" reste dans la liste (grise), jamais supprime', () => {
  // Contrairement a l'ancien LiberationPlacesPanel (remove_invitation_member,
  // qui supprimait la ligne guest) : ici la personne reste visible et
  // reversible en retapant le meme bouton.
  assert.doesNotMatch(panelSource, /members\/remove/);
  assert.match(panelSource, /opacity-45/);
  assert.match(panelSource, /line-through/);
});

test("chaque bouton (vert/rouge) rebascule vers 'attendu' si deja actif, sinon prend l'etat demande", () => {
  assert.match(panelSource, /guest\.arrival_status === status \? 'attendu' : status/);
});

test('materialise la liste "Membres: ..." des l\'ouverture, sans attendre une premiere action', () => {
  assert.match(panelSource, /parseMembersFromNotes/);
  assert.match(panelSource, /members\/initialize/);
});

test("set_guest_arrival_status calcule les deltas nombre_prevu/nombre_arrive a partir de l'ancien ET du nouvel etat, idempotent", () => {
  assert.match(migrationSource, /if v_old_status = p_status then\s*\n\s*return v_inv;/);
  assert.match(migrationSource, /v_prevu_delta/);
  assert.match(migrationSource, /v_arrive_delta/);
});

test("remove_invitation_member ne redecompte pas nombre_prevu pour une personne deja 'ne_viendra_pas', et sort nombre_arrive pour une personne 'arrive'", () => {
  // Trouve en concevant la fonctionnalite : une suppression definitive
  // depuis "Gerer les membres du groupe" doit rester coherente avec
  // arrival_status, sinon nombre_prevu/nombre_arrive derivent silencieusement.
  assert.match(migrationSource, /when v_guest_status = 'ne_viendra_pas' then v_inv\.nombre_prevu/);
  assert.match(migrationSource, /when v_guest_status = 'arrive' then greatest\(v_inv\.nombre_arrive - 1, 0\)/);
});

test('"Cet invité ne viendra pas" (invitation entiere) se cache des qu\'il y a plusieurs personnes nommees, sauf si deja marque', () => {
  // GuestArrivalPanel gere desormais le detail par personne pour un groupe
  // (nombre_prevu > 1) -- redondant sinon. Reste visible pour une invitation
  // solo et pour annuler un marquage deja pose.
  assert.match(checkinSource, /invitation\.nombre_arrive === 0 && \(invitation\.ne_viendra_pas \|\| invitation\.nombre_prevu <= 1\) && \(/);
});

test('un groupe (nombre_prevu > 1) propose "+ Invité supplémentaire" au lieu du compteur/bouton "Confirmer"', () => {
  assert.match(checkinSource, /invitation\.nombre_prevu > 1 \? \(/);
  assert.match(checkinSource, /\+ Invité supplémentaire \(non prévu\)/);
  assert.match(checkinSource, /onClick=\{\(\) => handleAdd\(1\)\}/);
});
