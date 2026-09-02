import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// GuestArrivalPanel.tsx et le checkin melangent JSX et TS : meme convention
// que les autres tests de ce dossier (voir floor-plan.test.ts) --
// inspection du code source plutot qu'import direct dans node:test.
const panelSource = readFileSync(new URL('../components/GuestArrivalPanel.tsx', import.meta.url), 'utf8');
const ensureRouteSource = readFileSync(new URL('../app/api/members/ensure/route.ts', import.meta.url), 'utf8');
const ensureMigrationSource = readFileSync(new URL('../supabase/migrations/0040_repair_missing_invitation_members.sql', import.meta.url), 'utf8');
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

test('"Cet invité ne viendra pas" (invitation entiere) se cache des que GuestArrivalPanel affiche reellement une liste, sauf si deja marque', () => {
  // GuestArrivalPanel gere desormais le detail par personne pour un groupe
  // -- redondant sinon. Reste visible pour une invitation solo et pour
  // annuler un marquage deja pose.
  assert.match(checkinSource, /invitation\.nombre_arrive === 0 && \(invitation\.ne_viendra_pas \|\| !hasMemberList\) && \(/);
});

test('la visibilite du panneau/compteur repose sur hasMemberList (etat reel), jamais sur nombre_prevu qui fluctue', () => {
  // Trouve par Gersom le 29/08/2026 : nombre_prevu baisse des qu'une
  // personne passe en "ne_viendra_pas" (voir set_guest_arrival_status) --
  // un groupe de 2 tombe a nombre_prevu=1 des la premiere exclusion. Baser
  // la visibilite du panneau la-dessus le faisait disparaitre completement,
  // avec la personne exclue dedans : plus aucun moyen de l'annuler.
  assert.match(checkinSource, /const \[hasMemberList, setHasMemberList\] = useState\(true\);/);
  assert.match(checkinSource, /onVisibilityChange=\{setHasMemberList\}/);
  assert.match(checkinSource, /hasMemberList \? \(/);
  assert.match(checkinSource, /!hasMemberList && \(/);
  // "nombre_prevu > 1" / "<= 1" ne doivent plus servir a decider quoi
  // afficher (seulement apparaitre, ailleurs, dans des messages d'excedent
  // sans rapport) -- cible precisement les anciennes conditions de branchement.
  assert.doesNotMatch(checkinSource, /\{invitation\.nombre_prevu > 1 \? \(/);
  assert.doesNotMatch(checkinSource, /\{invitation\.nombre_prevu <= 1 && \(/);
});

test('un groupe propose "+ Non prévu" au lieu du compteur/bouton "Confirmer"', () => {
  // Libellé raccourci le 02/09/2026 (voir 0046_guest_approval_linked_invitation)
  // pour partager la ligne avec le nouveau bouton "Invité surprise" -- le
  // libellé complet reste affiché dans l'en-tête du mini-formulaire.
  assert.match(checkinSource, /\+ Non prévu/);
  assert.match(checkinSource, /Invité supplémentaire \(non prévu\)/);
});

test('"+ Invité supplémentaire" est un ajout NOMME (add-unplanned), pas un +1 anonyme, pour garder le declenchement de la table de reserve', () => {
  // v1.23.0 : add_invitation_member (utilise par le "+" de GuestArrivalPanel)
  // augmente nombre_prevu en meme temps qu'il ajoute la personne, ce qui ne
  // cree jamais de depassement -- add_unplanned_arrival (migration 0030) ne
  // touche jamais nombre_prevu, pour continuer a declencher l'assignation de
  // table comme le faisait l'ancien "+1" anonyme (/api/checkin).
  assert.match(checkinSource, /members\/add-unplanned/);
  assert.match(checkinSource, /const exc = Math\.max\(0, updated\.nombre_arrive - updated\.nombre_prevu\);\s*\n\s*if \(exc > 0\) \{\s*\n\s*await openOverflowFlow\(exc\);/);
  const migrationSource = readFileSync(
    new URL('../supabase/migrations/0030_add_unplanned_arrival.sql', import.meta.url),
    'utf8'
  );
  assert.match(migrationSource, /v_new_arrive := v_inv\.nombre_arrive \+ 1;/);
  assert.doesNotMatch(migrationSource, /nombre_prevu = /);
});

test('GuestArrivalPanel se base sur members.length (pas nombre_prevu) pour decider s\'il affiche la liste', () => {
  assert.match(panelSource, /const visible = members\.length > 0;/);
  assert.doesNotMatch(panelSource, /const visible = invitation\.nombre_prevu/);
});

test('une ancienne invitation avec compteur agrege retrouve automatiquement ses lignes nominatives et les boutons individuels', () => {
  assert.match(panelSource, /Math\.max\(invitation\.nombre_prevu, invitation\.nombre_arrive, 1\)/);
  assert.match(panelSource, /fetch\('\/api\/members\/ensure'/);
  assert.match(ensureRouteSource, /hasCapability\(user\.role, 'manageMembers'\)/);
  assert.match(ensureMigrationSource, /create or replace function ensure_invitation_member_rows/);
  assert.match(ensureMigrationSource, /greatest\(v_inv\.nombre_prevu, v_inv\.nombre_arrive, 1\)/);
  assert.match(ensureMigrationSource, /Accompagnant à nommer/);
  assert.match(ensureMigrationSource, /returns invitations/);
});

test('un accompagnant non prevu doit avoir un nom avant le placement direct', () => {
  const route = readFileSync(new URL('../app/api/members/add-unplanned/route.ts', import.meta.url), 'utf8');
  assert.match(route, /Le nom de l’invité est requis/);
  assert.match(checkinSource, /placeholder="Prénom"/);
  assert.match(checkinSource, /openOverflowFlow\(exc\)/);
});

test('le parent n\'est prevenu de la visibilite qu\'une fois chargement ET materialisation stabilises (pas de flash "ancien compteur")', () => {
  // Trouve par Gersom le 30/08/2026 : ouvrir une fiche affichait brievement
  // l'ancien compteur agrege avant de basculer vers le panneau par-personne
  // -- `loading` passait a false avant que la materialisation depuis les
  // notes (ou le chargement reseau) ne soit vraiment terminee, donc
  // onVisibilityChange(false) partait a tort au parent entre-temps.
  assert.match(panelSource, /const settled = !loading && !initializing;/);
  assert.match(panelSource, /if \(!settled\) return;/);
  assert.doesNotMatch(panelSource, /if \(loading\) return <div/);
});

test('taper le nom d\'une personne le modifie directement (comme le titre de la fiche), reserve a manageMembers', () => {
  // Demande de Gersom le 30/08/2026 : plus besoin de passer par "Gerer les
  // membres du groupe" pour renommer -- meme geste que le titre de la fiche
  // (TopBar onTitleClick), applique par personne.
  assert.match(panelSource, /canManage \?/);
  assert.match(panelSource, /onClick=\{\(\) => startEdit\(guest\)\}/);
  assert.match(panelSource, /members\/rename/);
  assert.match(checkinSource, /canManage=\{canRename\}/);
});

test('bouton "+" pour ajouter une personne au groupe, reserve a manageMembers, meme capacite que "Gerer les membres"', () => {
  assert.match(panelSource, /canManage && !adding/);
  assert.match(panelSource, /members\/add/);
  assert.doesNotMatch(panelSource, /hasCapability/); // capacite fournie par le parent (prop canManage), pas re-decidee ici
});

test('bouton "deplacer" par personne, reserve a moveGuests (meme capacite que le deplacement d\'une invitation entiere)', () => {
  // Demande de Gersom le 30/08/2026 : "ça va faciliter le transfert de
  // personnes d'une table à une autre parce que maintenant on aura leurs
  // noms" -- confirme vouloir la fonctionnalite complete (pas juste la
  // remarque).
  assert.match(panelSource, /canMove &&/);
  assert.match(panelSource, /router\.push\('\/tables\/move-guest\/' \+ guest\.id\)/);
  assert.match(checkinSource, /canMoveGuest = hasCapability\(role, 'moveGuests'\)/);
  assert.match(checkinSource, /canMove=\{canMoveGuest\}/);
});

test("split_guest_to_new_invitation ne redecompte pas nombre_prevu sur la source pour 'ne_viendra_pas', sort nombre_arrive pour 'arrive', et NE TOUCHE JAMAIS nombre_prevu de la nouvelle invitation", () => {
  const splitMigrationSource = readFileSync(
    new URL('../supabase/migrations/0031_split_guest_to_new_invitation.sql', import.meta.url),
    'utf8'
  );
  assert.match(splitMigrationSource, /when v_guest_status = 'ne_viendra_pas' then v_source\.nombre_prevu/);
  assert.match(splitMigrationSource, /when v_guest_status = 'arrive' then greatest\(v_source\.nombre_arrive - 1, 0\)/);
  // arrival_status du guest reste inchange -- on reparente, on ne rebascule pas l'etat.
  assert.doesNotMatch(splitMigrationSource, /update guests set arrival_status/);
});

test('la route de deplacement de personne utilise la capacite moveGuests centralisee', () => {
  const moveRouteSource = readFileSync(
    new URL('../app/api/members/move/route.ts', import.meta.url),
    'utf8'
  );
  assert.match(moveRouteSource, /hasCapability\(user\.role, 'moveGuests'\)/);
  assert.match(moveRouteSource, /split_guest_to_new_invitation/);
});
