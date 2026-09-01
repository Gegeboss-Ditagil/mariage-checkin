import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bottomNav = readFileSync(new URL('../components/BottomNav.tsx', import.meta.url), 'utf8');
const accountMenu = readFileSync(new URL('../components/AccountMenu.tsx', import.meta.url), 'utf8');
const tablesPage = readFileSync(new URL('../app/tables/page.tsx', import.meta.url), 'utf8');
const scanPage = readFileSync(new URL('../app/scan/page.tsx', import.meta.url), 'utf8');
const scanStatsStrip = readFileSync(new URL('../components/ScanStatsStrip.tsx', import.meta.url), 'utf8');
const scanner = readFileSync(new URL('../components/QrScanner.tsx', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const topBar = readFileSync(new URL('../components/TopBar.tsx', import.meta.url), 'utf8');

// Les ecrans a barre de navigation basse (patron h-dvh + landscape:flex-row,
// voir la note dans BottomNav.tsx) -- verifie que chacun applique bien le
// meme patron plutot que de le dupliquer/oublier sur l'un d'eux. 10e ecran
// (/approbations) ajoute le 30/08/2026 avec l'invite surprise (v1.27.0),
// puis /agenda le 31/08/2026 (v1.29.0).
const LANDSCAPE_SHELL_PAGES = [
  '../app/dashboard/page.tsx',
  '../app/staff/page.tsx',
  '../app/scan/page.tsx',
  '../app/search/page.tsx',
  '../app/plan-table/page.tsx',
  '../app/exceptions/page.tsx',
  '../app/placement/page.tsx',
  '../app/history/page.tsx',
  '../app/admin/page.tsx',
  '../app/approbations/page.tsx',
  '../app/agenda/page.tsx',
];

test('la navigation principale ouvre directement le plan de table', () => {
  assert.doesNotMatch(bottomNav, /href: ['"]\/tables['"]/);
  assert.match(bottomNav, /href: ['"]\/plan-table['"], label: ['"]Plan['"]/);
  // /scan n'a plus ses propres boutons de navigation dupliques (retour
  // arriere du 30/08/2026, maquette Atrium/Maison : barre du bas partagee
  // avec Recherche/Plan/Bord/Staff, comme les autres ecrans) -- verifie
  // qu'il utilise bien le composant partage plutot que des liens en dur.
  assert.match(scanPage, /<BottomNav role={role} onCentralAction=/);
  assert.match(tablesPage, /redirect\(['"]\/plan-table['"]\)/);
});

test('historique et administration sont dans le menu du compte selon les capacites', () => {
  assert.match(accountMenu, /hasCapability\(role, ['"]viewHistory['"]\)/);
  assert.match(accountMenu, /hasCapability\(role, ['"]adminPanel['"]\)/);
  assert.match(accountMenu, /href="\/history"/);
  assert.match(accountMenu, /href="\/admin"/);
  assert.doesNotMatch(bottomNav, /Historique|Admin/);
});

test('le scanner supporte un demontage rapide sans exception non geree', () => {
  assert.match(scanner, /scanner\.isScanning/);
  assert.match(scanner, /try \{/);
  assert.match(scanner, /scannerRef\.current = null/);
});

test('le service worker ignore extensions et origines externes', () => {
  assert.match(serviceWorker, /url\.origin !== self\.location\.origin/);
  assert.match(serviceWorker, /\['http:', 'https:'\]/);
  assert.match(serviceWorker, /Response\.error\(\)/);
});

test('la barre de navigation "verre liquide" a un contraste et des cibles plus grandes (30/08/2026)', () => {
  // Demande de Gersom : le bar precedent etait "difficile a voir" -- icones
  // agrandies et libelles inactifs en text-muted (55% d'opacite) plutot que
  // text-faint (42%, trop peu contraste sur fond sombre).
  assert.match(bottomNav, /h-7 w-7/);
  assert.match(bottomNav, /min-h-\[84px\]/);
  assert.match(bottomNav, /h-\[78px\] w-\[78px\]/);
  assert.doesNotMatch(bottomNav, /text-text-faint/);
  assert.match(bottomNav, /text-text-muted/);
  // Pilule flottante (rayon genereux + ombre + flou) plutot que bar plate
  // collee au bord, sur les deux variantes (avec et sans bouton central).
  assert.match(bottomNav, /rounded-3xl/);
  assert.match(bottomNav, /backdrop-blur-2xl/);
});

test("le retour admin remplace /scan par /dashboard sans modifier les autres roles", () => {
  assert.match(topBar, /role === 'admin' && backHref === '\/scan' \? '\/dashboard' : backHref/);
  assert.match(topBar, /href=\{effectiveBackHref\}/);
});

test("admin et directeur ont Agenda dans la navigation, et Scan reste accessible a l'admin", () => {
  assert.match(bottomNav, /href: ['"]\/agenda['"], label: ['"]Agenda['"]/);
  assert.match(bottomNav, /admin:[\s\S]*href: ['"]\/scan['"], label: ['"]Scan['"]/);
  assert.match(bottomNav, /photoActionActive = !!onCentralAction && pathname\.startsWith\(['"]\/scan['"]\)/);
});

test("sur le dashboard admin seulement, Scan est central et Approbations descend dans la barre", () => {
  assert.match(bottomNav, /const ADMIN_DASHBOARD_ITEMS/);
  assert.match(bottomNav, /role === 'admin' && pathname === '\/dashboard' \? ADMIN_DASHBOARD_ITEMS/);
  assert.match(bottomNav, /ADMIN_DASHBOARD_ITEMS[\s\S]*href: '\/scan'[\s\S]*href: '\/approbations'/);
  assert.doesNotMatch(bottomNav, /admin: \[[\s\S]*href: '\/approbations'[\s\S]*\],\n\};/);
  assert.match(accountMenu, /href="\/approbations"/);
  assert.match(accountMenu, /pendingApprovals/);
});

test("l'agenda affiche le chronogramme sans inventer les affectations futures", () => {
  const agendaPage = readFileSync(new URL('../app/agenda/page.tsx', import.meta.url), 'utf8');
  const agendaData = readFileSync(new URL('../lib/eventAgenda.ts', import.meta.url), 'utf8');
  assert.match(agendaPage, /hasCapability\(role, ['"]viewAgenda['"]\)/);
  assert.match(agendaPage, /Responsable à attribuer/);
  assert.match(agendaData, /08:00/);
  assert.match(agendaData, /05:00/);
});

test('la barre de navigation devient une bande verticale au bord droit en paysage (telephone tourne / iPad)', () => {
  // Demande de Gersom : "si je tourne le telephone sur le cote, je veux que
  // ca fasse vraiment comme une bascule ... les boutons vont a la droite au
  // lieu de rester en bas ... figes a droite mais qu'on peut scroll de haut
  // en bas ... la meme chose sur un iPad" -- variante Tailwind `landscape:`
  // (media query orientation native, aucune config necessaire).
  assert.match(bottomNav, /landscape:flex-col/);
  assert.match(bottomNav, /landscape:h-full/);
  assert.match(bottomNav, /landscape:w-20/);
  assert.match(bottomNav, /landscape:safe-right/);
  // Le bouton central se souleve vers le contenu (gauche) plutot que vers le
  // haut quand la barre devient verticale.
  assert.match(bottomNav, /landscape:-ml-6/);

  for (const relPath of LANDSCAPE_SHELL_PAGES) {
    const source = readFileSync(new URL(relPath, import.meta.url), 'utf8');
    assert.match(
      source,
      /flex h-dvh flex-col overflow-hidden landscape:flex-row/,
      relPath + " doit utiliser le patron d'ecran responsive paysage"
    );
  }
});

test('/scan affiche une bande d\'information de base (arrivees/remplissage) juste au-dessus de la barre de navigation', () => {
  // Demande de Gersom : "en dessous de l'ecran scan ... de l'information de
  // base du tableau de bord -- le nombre d'invites, le nombre arrives, la
  // progression du remplissage de la salle".
  assert.match(scanPage, /<ScanStatsStrip \/>/);
  assert.match(scanStatsStrip, /nombre_prevu/);
  assert.match(scanStatsStrip, /nombre_arrive/);
  assert.match(scanStatsStrip, /CapacityGauge/);
  assert.match(scanStatsStrip, /href="\/dashboard"/);
  assert.match(scanStatsStrip, /min-h-\[72px\]/);
});
