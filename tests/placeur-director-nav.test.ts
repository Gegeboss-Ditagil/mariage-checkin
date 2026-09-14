import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canAccessPath, hasCapability } from '../lib/permissions.ts';

// Retour de Gersom le 14/09/2026 (captures d'écran d'Agent001 sur /scan,
// comparées à celles de Rémy Landu) : "Voici ce que je vois quand je suis
// sur l'accueil de Agent001 qui est un placeur... je m'attends plutôt à
// voir un menu... un peu comme celui de Rémy Landu." Vérifié en base
// (`select role from users where nom_affichage = 'Agent001'`) : ce compte
// est bien `placeur`, pas `agent_checkin` comme les échanges précédents sur
// "Agent001"/"les agents scan" le laissaient penser -- ce correctif ne
// touche donc en rien agent_checkin (déjà traité les 03 et 13/09/2026).
//
// placeur utilisait jusqu'ici STAFF_ITEMS (Scan au centre, Staff en dernier
// onglet) sans jamais avoir reçu le remplacement Staff -> Approbations déjà
// fait pour admin/directeur/agent_checkin/visibilite. Gersom a choisi
// explicitement l'option la plus large (calquer tout le comportement
// contextuel de directeur, pas seulement le dernier onglet) quand on lui a
// posé la question.

const bottomNav = readFileSync(new URL('../components/BottomNav.tsx', import.meta.url), 'utf8');

test('placeur gagne le meme comportement contextuel que directeur (isDirectorStyleNav) : Tableau de bord au centre hors /dashboard, /scan et /agenda', () => {
  assert.match(
    bottomNav,
    /const isDirectorStyleNav = role === 'admin' \|\| role === 'directeur' \|\| role === 'placeur' \|\| role === 'agent_checkin';/
  );
  assert.match(bottomNav, /CENTRAL_HREF: Record<string, string> = \{\s*\n\s*directeur: '\/dashboard',\s*\n\s*placeur: '\/dashboard',/);
});

test("la barre generique de placeur reprend exactement la forme de directeur (Recherche, Plan, Bord, Scan, Approbations), sans plus jamais Staff", () => {
  const placeurBlock = bottomNav.slice(bottomNav.indexOf('placeur: ['), bottomNav.indexOf('agent_checkin: AGENT_CHECKIN_ITEMS'));
  assert.match(placeurBlock, /href: ['"]\/search['"], label: ['"]Recherche['"]/);
  assert.match(placeurBlock, /href: ['"]\/plan-table['"], label: ['"]Plan['"]/);
  assert.match(placeurBlock, /href: ['"]\/dashboard['"], label: ['"]Bord['"]/);
  assert.match(placeurBlock, /href: ['"]\/scan['"], label: ['"]Scan['"]/);
  assert.match(placeurBlock, /APPROVALS_ITEM,/);
  assert.doesNotMatch(placeurBlock, /href: ['"]\/staff['"]/);
  // La constante STAFF_ITEMS elle-meme (plus qu'un onglet parmi d'autres,
  // c'etait le tableau entier utilise par placeur) est supprimee -- seules
  // des mentions en commentaire du nom historique peuvent subsister.
  assert.doesNotMatch(bottomNav, /const STAFF_ITEMS/);
});

test("placeur gagne viewAgenda en lecture seule (jamais manageAgenda, reservee a admin/directeur), pour que l'onglet Agenda affiche sur /dashboard/scan/agenda soit reellement accessible", () => {
  assert.equal(hasCapability('placeur', 'viewAgenda'), true);
  assert.equal(hasCapability('placeur', 'manageAgenda'), false);
  assert.equal(canAccessPath('placeur', '/agenda'), true);
  // Inchange : placeur garde ses capacites d'approbation existantes.
  assert.equal(hasCapability('placeur', 'viewGuestApprovals'), true);
  assert.equal(hasCapability('placeur', 'submitGuestApproval'), true);
  assert.equal(hasCapability('placeur', 'assignGuestApproval'), true);
  assert.equal(hasCapability('placeur', 'reviewGuestApproval'), false);
});

test('sur /scan, placeur voit le bouton photo (submitGuestApproval) comme directeur, jamais un aller-retour vers Bord', () => {
  // photoActionActive ne depend que de onCentralAction (passe par app/scan/
  // page.tsx si hasCapability(role,'submitGuestApproval')) et de central.href
  // === '/scan' -- verifie ici que la condition reste role-agnostique.
  assert.match(bottomNav, /photoActionActive = !!onCentralAction && pathname\.startsWith\(['"]\/scan['"]\) && central\.href === ['"]\/scan['"]/);
  assert.equal(hasCapability('placeur', 'submitGuestApproval'), true);
});

// Meme jour, retour de Gersom sur Scotty Sanda (agent_checkin) : "quand on
// est dans le tableau de bord, je voudrais que le bouton dore en bas soit
// le bouton scan plutot" -- le bouton central (Bord, CENTRAL_HREF.
// agent_checkin) pointait vers /dashboard meme en y etant deja, un
// aller-retour inutile identique a celui deja corrige pour admin/directeur
// le 02/09/2026. agent_checkin rejoint donc isDirectorStyleNav : Scan au
// centre sur /dashboard/scan/agenda (jamais l'appareil photo, ce role n'a
// pas submitGuestApproval), Bord au centre partout ailleurs (barre generique
// AGENT_CHECKIN_ITEMS inchangee sinon).
test("agent_checkin rejoint le meme comportement contextuel : Scan (pas l'appareil photo) au centre sur /dashboard/scan/agenda, au lieu d'un aller-retour vers Bord", () => {
  assert.match(bottomNav, /isDirectorStyleNav = role === 'admin' \|\| role === 'directeur' \|\| role === 'placeur' \|\| role === 'agent_checkin'/);
  assert.equal(hasCapability('agent_checkin', 'submitGuestApproval'), false);
  // La barre generique (hors /dashboard/scan/agenda) reste inchangee.
  const agentBlock = bottomNav.slice(bottomNav.indexOf('const AGENT_CHECKIN_ITEMS'), bottomNav.indexOf('const READ_ONLY_ITEMS'));
  assert.match(agentBlock, /href: ['"]\/dashboard['"], label: ['"]Bord['"]/);
  assert.match(agentBlock, /AGENDA_ITEM,\s*\n\s*APPROVALS_ITEM,\s*\n\];/);
});
