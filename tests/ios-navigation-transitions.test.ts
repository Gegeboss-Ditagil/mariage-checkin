import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.53.16, retour de Gersom (capture d'écran de l'app Musique d'Apple en
// référence) : "il y a beaucoup de flash, surtout quand je navigue entre les
// onglets recherche et plan... base-toi vraiment sur leur style [iOS],
// leur guide, tout en gardant la même identité de l'application. C'est
// surtout au niveau de la navigation. Comment est-ce que les éléments se
// déplacent ?" Deux volets : (1) un vrai bug -- fallback={null} des
// Suspense requis par useSearchParams() laissait un trou de peinture (rien
// du tout, pas même le fond de page) le temps que la route change, sur les
// deux pages précisément citées (/search, /plan-table) ; (2) une demande de
// recherche + adoption d'une librairie open-source reconnue pour donner un
// vrai fondu natif iOS entre les pages plutôt que le remplacement brut du
// DOM par défaut du navigateur.

const layoutSource = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const bottomNavSource = readFileSync(new URL('../components/BottomNav.tsx', import.meta.url), 'utf8');
const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

test('next-view-transitions est une dépendance déclarée (pas juste installée localement)', () => {
  const pkg = JSON.parse(packageJson);
  assert.ok(pkg.dependencies['next-view-transitions'], 'next-view-transitions doit être dans dependencies');
});

test('app/layout.tsx enveloppe toute la page avec <ViewTransitions>, autour de <html> comme documenté par la librairie', () => {
  assert.match(layoutSource, /import \{ ViewTransitions \} from 'next-view-transitions';/);
  assert.match(layoutSource, /<ViewTransitions>\s*\n\s*<html /);
  assert.match(layoutSource, /<\/html>\s*\n\s*<\/ViewTransitions>/);
});

test('app/globals.css règle la durée du fondu de page et fige la barre de navigation (jamais de double-affichage/clignotement pendant la transition)', () => {
  assert.match(globalsCss, /::view-transition-old\(root\),\s*\n::view-transition-new\(root\) \{\s*\n\s*animation-duration: 180ms;/);
  assert.match(globalsCss, /\.bottom-nav-glass \{\s*\n\s*view-transition-name: bottom-nav;\s*\n\}/);
  assert.match(globalsCss, /::view-transition-group\(bottom-nav\) \{\s*\n\s*animation: none;\s*\n\}/);
  // Respecte prefers-reduced-motion : desactive completement l'animation des
  // pseudo-elements de transition, pas seulement celle du reste de l'appli
  // (deja couverte par la regle generique existante plus haut dans le fichier).
  assert.match(globalsCss, /::view-transition-group\(\*\),\s*\n\s*::view-transition-old\(\*\),\s*\n\s*::view-transition-new\(\*\) \{\s*\n\s*animation: none !important;/);
});

test('BottomNav : les onglets (SideLink) ont désormais un retour tactile au toucher (dim instantané), comme le bouton central', () => {
  assert.match(bottomNavSource, /active:opacity-60/);
});

// Les 11 fichiers qui utilisaient <Link> (next/link) et les 22 qui
// utilisaient useRouter (next/navigation) avant ce lot -- verifie qu'aucun
// n'est reste sur l'ancien import, plutot qu'un grep global qui masquerait
// silencieusement un fichier oublie (ou un nouveau fichier futur non ajoute
// ici, moins grave qu'une regression sur un fichier deja connu).
const LINK_FILES = [
  '../app/admin/wizard/page.tsx',
  '../app/admin/page.tsx',
  '../app/approbations/page.tsx',
  '../app/plan-table/page.tsx',
  '../components/NextAgendaActivity.tsx',
  '../components/BottomNav.tsx',
  '../components/AddInvitationButton.tsx',
  '../components/TopBar.tsx',
  '../components/GuestApprovalsShortcut.tsx',
  '../components/ScanStatsStrip.tsx',
  '../components/AccountMenu.tsx',
];
const ROUTER_FILES = [
  '../app/tables/overflow/[assignmentId]/page.tsx',
  '../app/tables/move-guest/[guestId]/page.tsx',
  '../app/tables/add/page.tsx',
  '../app/tables/[tableId]/page.tsx',
  '../app/tables/move/[invitationId]/page.tsx',
  '../app/tables/move-multiple/page.tsx',
  '../app/checkin/[invitationId]/page.tsx',
  '../app/checkin/[invitationId]/members/page.tsx',
  '../app/checkin/[invitationId]/merge/page.tsx',
  '../app/search/page.tsx',
  '../app/staff/page.tsx',
  '../app/approbations/[id]/assign/page.tsx',
  '../app/login/page.tsx',
  '../app/scan/page.tsx',
  '../app/scan/guest-approval/page.tsx',
  '../app/onboarding/theme/page.tsx',
  '../app/table/[tableId]/page.tsx',
  '../app/dashboard/page.tsx',
  '../app/dashboard/liste/page.tsx',
  '../components/GuestArrivalPanel.tsx',
  '../components/SplashScreen.tsx',
  '../components/AccountMenu.tsx',
];

test("les fichiers qui affichaient des liens de navigation utilisent désormais <Link> de next-view-transitions, jamais next/link", () => {
  for (const path of LINK_FILES) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /from 'next\/link'/, path + " ne doit plus importer depuis 'next/link'");
    assert.match(source, /import \{ Link \} from 'next-view-transitions';/, path + ' doit importer Link depuis next-view-transitions');
  }
});

test('les fichiers qui naviguent par programmation utilisent useTransitionRouter (aliasé useRouter), jamais useRouter de next/navigation', () => {
  for (const path of ROUTER_FILES) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\{ [^}]*\buseRouter\b[^}]* \} from 'next\/navigation'/, path + ' ne doit plus importer useRouter depuis next/navigation');
    assert.match(source, /import \{ useTransitionRouter as useRouter \} from 'next-view-transitions';/, path + ' doit utiliser useTransitionRouter (aliasé useRouter)');
  }
});

// Voir aussi CHANGELOG v1.53.16 : le vrai bug corrigé (fallback={null} sans
// fond) sur les six écrans concernés.
test("les six écrans dont le Suspense (requis par useSearchParams) n'affichait rien pendant le changement de route ont désormais un fallback avec un fond peint", () => {
  const sites = [
    { path: '../app/search/page.tsx', bg: 'fixed inset-0 bg-bg' },
    { path: '../app/plan-table/page.tsx', bg: 'fixed inset-0 bg-bg' },
    { path: '../app/tables/[tableId]/page.tsx', bg: 'min-h-dvh bg-bg' },
    { path: '../app/dashboard/liste/page.tsx', bg: 'min-h-dvh bg-bg' },
    { path: '../app/onboarding/theme/page.tsx', bg: 'min-h-dvh bg-bg' },
    { path: '../app/login/page.tsx', bg: 'min-h-dvh bg-bg' },
  ];
  for (const { path, bg } of sites) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /Suspense fallback=\{null\}/, path + ' ne doit plus avoir de fallback vide');
    const escaped = bg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(source, new RegExp('Suspense fallback=\\{<div className="' + escaped + '" />\\}'), path + ' doit peindre un fond pendant le Suspense');
  }
});
