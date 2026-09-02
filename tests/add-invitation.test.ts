import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { hasCapability } from '../lib/permissions.ts';

const addPage = readFileSync(new URL('../app/tables/add/page.tsx', import.meta.url), 'utf8');
const addRoute = readFileSync(new URL('../app/api/invitations/add/route.ts', import.meta.url), 'utf8');
const planTablePage = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');
const checkinPage = readFileSync(new URL('../app/checkin/[invitationId]/page.tsx', import.meta.url), 'utf8');
const tagsLib = readFileSync(new URL('../lib/tags.ts', import.meta.url), 'utf8');

// Corrige le 02/09/2026 (retour de Remy en test) : le formulaire "+ Ajouter
// un invite" (/tables/add) etait deja visible pour directeur/placeur via une
// liste de roles codee en dur dans la page, mais /api/invitations/add
// exigeait la capacite `addInvitation` -- reservee a l'admin seul avant ce
// correctif. Resultat : la creation echouait toujours en 401 pour
// directeur/placeur, un bug jamais remarque car cette page n'avait aucun
// lien entrant dans l'application.
test("addInvitation est desormais ouvert au directeur (comme demande), la page utilise la capacite centralisee au lieu d'une liste de roles locale", () => {
  assert.equal(hasCapability('admin', 'addInvitation'), true);
  assert.equal(hasCapability('directeur', 'addInvitation'), true);
  for (const role of ['placeur', 'agent_checkin', 'visibilite'] as const) {
    assert.equal(hasCapability(role, 'addInvitation'), false, role + ' ne doit pas avoir addInvitation');
  }
  assert.match(addPage, /const canAdd = hasCapability\(role, ['"]addInvitation['"]\)/);
  // Ne doit plus recreer de liste de roles locale (voir CLAUDE.md).
  assert.doesNotMatch(addPage, /role === ['"]admin['"] \|\| role === ['"]directeur['"] \|\| role === ['"]placeur['"]/);
  assert.match(addRoute, /hasCapability\(user\.role, ['"]addInvitation['"]\)/);
});

test("le formulaire capture le telephone (avec indicatif) et propose les etiquettes, restreintes a manageTags", () => {
  assert.match(addPage, /Téléphone \(optionnel\)/);
  assert.match(addPage, /placeholder="\+33 6 12 34 56 78"/);
  assert.match(addPage, /indicatif du pays inclus/i);
  assert.match(addPage, /const canTag = hasCapability\(role, ['"]manageTags['"]\)/);
  assert.match(addPage, /\{canTag && \(/);
  assert.match(addPage, /ETIQUETTES_RAPIDES/);
  assert.match(addPage, /Staff : visible de tout le monde/);

  // Cote serveur : les etiquettes envoyees ne sont appliquees que si le role
  // a manageTags, jamais sur la seule presence du champ dans la requete.
  assert.match(addRoute, /hasCapability\(user\.role, ['"]manageTags['"]\)/);
  assert.match(addRoute, /const tags: string\[\] = hasCapability\(user\.role, ['"]manageTags['"]\) \? requestedTags : \[\]/);
  assert.match(addRoute, /add_invitation_tag/);
  assert.doesNotMatch(addRoute, /table_number/);
  assert.match(addRoute, /table_id/);
});

test("le plan de table propose un raccourci + Invité reserve a addInvitation, et le formulaire choisit la table via TablePicker", () => {
  assert.match(planTablePage, /hasCapability\(role, ['"]addInvitation['"]\)/);
  assert.match(planTablePage, /href="\/tables\/add"/);
  assert.match(addPage, /<TablePicker/);
  assert.match(addPage, /computeTableCapacities/);
});

test("les etiquettes rapides vivent dans lib/tags.ts, plus dediees a une seule page", () => {
  assert.match(tagsLib, /export const ETIQUETTES_RAPIDES/);
  assert.match(tagsLib, /SERVICES/);
  assert.match(checkinPage, /import \{ ETIQUETTES_RAPIDES, libelleEtiquette \} from ['"]@\/lib\/tags['"]/);
  assert.doesNotMatch(checkinPage, /const ETIQUETTES_RAPIDES/);
});
