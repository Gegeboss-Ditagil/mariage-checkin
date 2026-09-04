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
const approvalShortcut = readFileSync(new URL('../components/GuestApprovalsShortcut.tsx', import.meta.url), 'utf8');
const rootLayout = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const dashboardPage = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

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
  assert.doesNotMatch(bottomNav, /label: ['"](?:Historique|Admin)['"]/);
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
  assert.match(bottomNav, /h-\[30px\] w-\[30px\]/);
  assert.match(bottomNav, /min-h-\[96px\]/);
  assert.match(bottomNav, /h-\[84px\] w-\[84px\]/);
  assert.match(bottomNav, /bottom-nav-icon-tile/);
  assert.match(bottomNav, /bottom-nav-central/);
  assert.doesNotMatch(bottomNav, /text-text-faint/);
  assert.match(bottomNav, /text-text-muted/);
  // Pilule flottante (rayon genereux + ombre + flou) plutot que bar plate
  // collee au bord, sur les deux variantes (avec et sans bouton central).
  assert.match(globalStyles, /\.bottom-nav-glass[\s\S]*border-radius: 2\.25rem/);
  assert.match(globalStyles, /--nav-glass: rgba\(238, 242, 250, 0\.58\)/);
  assert.match(globalStyles, /--nav-glass: rgba\(35, 35, 44, 0\.56\)/);
  assert.match(globalStyles, /backdrop-filter: blur\(34px\) saturate\(185%\)/);
  assert.match(globalStyles, /border-color: var\(--nav-glass-border\)/);
});

test('la camera du scanner utilise la hauteur du viewport au lieu du petit ratio horizontal 3/2', () => {
  // Resserre le 02/09/2026 (55dvh -> 46dvh) pour laisser la place a
  // NextAgendaActivity sur /scan sans avoir a scroller.
  assert.match(scanner, /h-\[clamp\(320px,46dvh,620px\)\]/);
  assert.match(scanner, /\[&_video\]:object-cover/);
  assert.match(scanner, /qrbox: \(viewfinderWidth, viewfinderHeight\)/);
  assert.doesNotMatch(scanner, /aspect-\[3\/2\]/);
});

test("le retour des comptes admin et visibilite revient toujours au dashboard", () => {
  assert.match(topBar, /role === 'admin' \|\| role === 'visibilite'/);
  assert.match(topBar, /\? '\/dashboard' : backHref/);
  assert.match(topBar, /href=\{effectiveBackHref\}/);
});

test("sur le tableau de bord, Retour ouvre directement le scanner pour tout role qui peut scanner, sans passer par la SplashScreen", () => {
  // Corrige le 02/09/2026 (retour de Remy en test) : l'ancienne cible ('/')
  // repassait par la SplashScreen, qui redirige elle-meme vers /dashboard
  // pour le directeur (boucle visible, "page passeport bleu") et vers /scan
  // pour l'admin apres un flash inutile -- va desormais droit au but.
  assert.match(dashboardPage, /backHref=\{role && hasCapability\(role, 'scan'\) \? '\/scan' : undefined\}/);
  assert.doesNotMatch(dashboardPage, /role === 'admin' \|\| role === 'directeur'\s*\n\s*\? '\//);
  // Le garde-fou admin/visibilite de TopBar ne doit jamais reecrire cette
  // cible en boucle vers /dashboard alors qu'on y est deja.
  assert.match(topBar, /onDashboard = pathname === '\/dashboard' \|\| pathname\?\.startsWith\('\/dashboard\/'\)/);
  assert.match(topBar, /backHref !== '\/' && !onDashboard/);
});

test("admin et directeur gardent l'appareil photo au centre sur /scan, avec Tableau de bord en raccourci lateral", () => {
  // Corrige le 02/09/2026 (retour de Remy en test) : le bouton central de
  // /scan redevenait Tableau de bord au lieu de rester l'appareil photo, et
  // Approbations -- deja un gros bouton dedie sur cette page, voir
  // GuestApprovalsShortcut -- doublonnait inutilement la barre du bas.
  assert.match(bottomNav, /href: ['"]\/agenda['"], label: ['"]Agenda['"]/);
  assert.match(bottomNav, /admin:[\s\S]*href: ['"]\/scan['"], label: ['"]Scan['"]/);
  const directeurBlock = bottomNav.slice(bottomNav.indexOf('directeur: ['), bottomNav.indexOf('placeur:'));
  assert.match(directeurBlock, /href: ['"]\/scan['"], label: ['"]Scan['"]/);
  assert.doesNotMatch(directeurBlock, /href: ['"]\/staff['"]/);

  const scanBranch = bottomNav.slice(
    bottomNav.indexOf("pathname.startsWith('/scan')"),
    bottomNav.indexOf('} else {')
  );
  assert.match(scanBranch, /central = SCAN_ITEM/);
  assert.match(scanBranch, /right = \[AGENDA_ITEM, DASHBOARD_ITEM\]/);
  assert.doesNotMatch(scanBranch, /APPROVALS_ITEM/);

  const dashboardBranch = bottomNav.slice(
    bottomNav.indexOf("pathname.startsWith('/dashboard')"),
    bottomNav.indexOf("pathname.startsWith('/scan')")
  );
  assert.match(dashboardBranch, /central = SCAN_ITEM/);
  assert.match(dashboardBranch, /right = \[AGENDA_ITEM, \{ \.\.\.APPROVALS_ITEM, badge: pendingCount \}\]/);

  assert.match(bottomNav, /bottom-nav-glass/);
  assert.match(bottomNav, /photoActionActive = !!onCentralAction && pathname\.startsWith\(['"]\/scan['"]\) && central\.href === ['"]\/scan['"]/);
});

test("sur /agenda, Agenda et Tableau de bord echangent leurs raccourcis lateraux", () => {
  const agendaBranch = bottomNav.slice(
    bottomNav.indexOf("pathname.startsWith('/agenda')"),
    bottomNav.indexOf("pathname.startsWith('/scan')")
  );
  assert.match(agendaBranch, /central = SCAN_ITEM/);
  assert.match(agendaBranch, /right = \[AGENDA_ITEM, DASHBOARD_ITEM\]/);
});

test("Approbations reste dans le menu du compte, dans la barre Dashboard mais plus dans la barre Scan (deja un gros bouton dedie)", () => {
  assert.match(bottomNav, /APPROVALS_ITEM/);
  assert.match(accountMenu, /href="\/approbations"/);
  assert.match(accountMenu, /pendingApprovals/);
});

test("le scanner affiche un grand raccourci Approbations juste au-dessus de la progression", () => {
  assert.match(scanPage, /<GuestApprovalsShortcut role=\{role\} \/>[\s\S]*<ScanStatsStrip \/>/);
  assert.match(approvalShortcut, /min-h-14/);
  assert.match(approvalShortcut, /pendingCount/);
  assert.match(approvalShortcut, /href="\/approbations"/);
});

test("l'agenda partage permet ajout, affectation et validation aux responsables autorises", () => {
  const agendaPage = readFileSync(new URL('../app/agenda/page.tsx', import.meta.url), 'utf8');
  const agendaApi = readFileSync(new URL('../app/api/agenda/route.ts', import.meta.url), 'utf8');
  const agendaMigration = readFileSync(new URL('../supabase/migrations/0039_shared_agenda.sql', import.meta.url), 'utf8');
  const agendaManagerMigration = readFileSync(new URL('../supabase/migrations/0041_agenda_manager_access.sql', import.meta.url), 'utf8');
  const nellyDirectorMigration = readFileSync(new URL('../supabase/migrations/0042_promote_nelly_directeur.sql', import.meta.url), 'utf8');
  assert.match(agendaPage, /setCanManage\(data\.canManage === true\)/);
  // Le placeholder "Responsable à attribuer" a ete retire des cartes de la
  // liste le 02/09/2026 (retour de Gersom : "on affiche responsable
  // seulement si il y en a un") -- la ligne responsables ne s'affiche plus
  // du tout tant que personne n'est assigne, voir tests/agenda-form.test.ts.
  assert.doesNotMatch(agendaPage, /Responsable à attribuer/);
  assert.match(agendaPage, /Ajouter une activité ici/);
  assert.match(agendaPage, /assignee_ids/);
  assert.match(agendaPage, /completed/);
  assert.match(agendaPage, /Modifier l’activité/);
  assert.match(agendaPage, /name="time_label"/);
  assert.match(agendaPage, /name="details"/);
  assert.match(agendaApi, /hasCapability\(user\.role, 'manageAgenda'\)/);
  assert.doesNotMatch(agendaApi, /agenda_manager/);
  assert.match(agendaMigration, /create table if not exists agenda_items/);
  assert.match(agendaMigration, /alter table agenda_items enable row level security/);
  assert.match(agendaManagerMigration, /add column if not exists agenda_manager boolean/);
  assert.match(agendaManagerMigration, /Nelly Dos Goncalves/);
  assert.match(nellyDirectorMigration, /set role = 'directeur'/);
  assert.match(nellyDirectorMigration, /Nelly Dos Goncalves/);
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
  // Le shell racine etait encore bloque a max-w-md : sur iPad, la barre
  // verticale se placait a droite d'une colonne etroite et laissait de
  // larges bandes noires sur les cotes. Le portrait reste borne, mais le
  // paysage doit explicitement lever cette largeur maximale.
  assert.match(rootLayout, /w-full max-w-md[^"]*landscape:max-w-none/);

  for (const relPath of LANDSCAPE_SHELL_PAGES) {
    const source = readFileSync(new URL(relPath, import.meta.url), 'utf8');
    assert.match(
      source,
      /flex h-dvh flex-col overflow-hidden landscape:flex-row/,
      relPath + " doit utiliser le patron d'ecran responsive paysage"
    );
  }
});

test("changer de table ou de fiche invite (meme route dynamique) reinitialise l'etat avant de recharger, pour ne jamais afficher l'ancienne page en attendant la nouvelle", () => {
  // Corrige le 03/09/2026 (retour de Gersom : "à chaque fois que je change
  // de page ... surtout dans l'option des tables, je vois comme l'ancienne
  // page en premier et ensuite je vois la nouvelle") -- Next.js reutilise la
  // meme instance de composant en passant d'un /table/[tableId] (ou
  // /checkin/[invitationId]) a un autre : sans un reset explicite au debut
  // de l'effet garde sur le parametre d'URL, l'ancien contenu restait
  // entierement affiche pendant que la nouvelle requete etait en vol.
  const tableScanPage = readFileSync(new URL('../app/table/[tableId]/page.tsx', import.meta.url), 'utf8');
  const tableListPage = readFileSync(new URL('../app/tables/[tableId]/page.tsx', import.meta.url), 'utf8');
  const checkinPage = readFileSync(new URL('../app/checkin/[invitationId]/page.tsx', import.meta.url), 'utf8');
  const membersPage = readFileSync(new URL('../app/checkin/[invitationId]/members/page.tsx', import.meta.url), 'utf8');

  assert.match(tableScanPage, /setLoading\(true\);\s*\n\s*setTable\(null\);\s*\n\s*setInvitations\(\[\]\);/);
  // /tables/[tableId] n'avait meme pas d'etat "loading" avant ce correctif --
  // l'ancienne table s'affichait donc integralement, sans le moindre flash
  // de chargement pour masquer la transition.
  assert.match(tableListPage, /const \[loading, setLoading\] = useState\(true\);/);
  assert.match(tableListPage, /setLoading\(true\);\s*\n\s*setTable\(null\);\s*\n\s*setInvitations\(\[\]\);/);
  assert.match(tableListPage, /if \(loading\) \{\s*\n\s*return \(/);
  assert.match(checkinPage, /setInvitation\(null\);\s*\n\s*setNotFound\(false\);/);
  assert.match(membersPage, /setLoading\(true\);\s*\n\s*setInvitation\(null\);/);
});

test("le flash de navigation touchait aussi les ecrans mono-usage (deplacer/gerer l'excedent/assigner/fusionner), pas seulement les fiches table/invite -- meme correctif : TopBar reste visible pendant le chargement", () => {
  // Corrige le 03/09/2026 (retour de Gersom, deuxieme signalement : "à
  // chaque fois que je navigue... un flash" persistait apres le premier
  // correctif) -- ces six ecrans faisaient un retour anticipe SANS TopBar
  // pendant le chargement (contrairement a /table(s)/[tableId] deja
  // corriges) : l'en-tete apparaissait donc brusquement une fois les
  // donnees chargees, ce qui se lisait comme un flash entre deux pages.
  const affected: { path: string; title: string }[] = [
    { path: '../app/tables/overflow/[assignmentId]/page.tsx', title: "Gérer l'excédent" },
    { path: '../app/tables/move-guest/[guestId]/page.tsx', title: 'Déplacer vers une table' },
    { path: '../app/tables/move/[invitationId]/page.tsx', title: 'Déplacer vers une table' },
    { path: '../app/checkin/[invitationId]/merge/page.tsx', title: 'Fusionner avec un autre groupe' },
  ];
  for (const { path, title } of affected) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, new RegExp('<TopBar title="' + title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"'), path + ' doit garder son TopBar pendant le chargement');
    // Plus de classe Tailwind invalide "justify-center/50" (jamais
    // appliquee -- copiee/collee sans jamais avoir ete remarquee) dans un
    // attribut className -- seule la mention en commentaire explicatif
    // peut subsister.
    assert.doesNotMatch(source, /className="[^"]*justify-center\/50/, path);
  }
  const moveMultiple = readFileSync(new URL('../app/tables/move-multiple/page.tsx', import.meta.url), 'utf8');
  assert.match(moveMultiple, /if \(loading\) \{[\s\S]{0,200}<TopBar/);
  const assignPage = readFileSync(new URL('../app/approbations/[id]/assign/page.tsx', import.meta.url), 'utf8');
  assert.match(assignPage, /if \(loading \|\| !request\) \{[\s\S]{0,500}<TopBar/);
});

test("agent_checkin voit Agenda (lecture seule) a la place de Staff dans sa barre du bas, /staff reste atteignable par le badge QR", () => {
  // Retour de Gersom le 03/09/2026 sur Agent001 : "il ne devrait pas voir
  // en bas a droite staff... il devrait voir agenda a la place".
  assert.match(bottomNav, /AGENT_CHECKIN_ITEMS/);
  assert.match(bottomNav, /agent_checkin: AGENT_CHECKIN_ITEMS/);
  const agentBlock = bottomNav.slice(
    bottomNav.indexOf('const AGENT_CHECKIN_ITEMS'),
    bottomNav.indexOf('const READ_ONLY_ITEMS')
  );
  assert.match(agentBlock, /href: ['"]\/agenda['"], label: ['"]Agenda['"]/);
  assert.doesNotMatch(agentBlock, /href: ['"]\/staff['"]/);
});

test("le splash avant connexion affiche discretement la version applicative, toujours synchronisee avec package.json (jamais une variable dupliquee)", () => {
  // Retour de Gersom le 03/09/2026 : "chaque fois que j'ouvre, je peux
  // savoir si je suis en train de voir la dernière version... on va mettre
  // ça à jour à chaque fois". Importee directement depuis package.json
  // (source de verite, voir docs/VERSIONING.md) dans app/page.tsx (server
  // component), transmise en prop au splash -- ne peut donc jamais deriver
  // du numero reellement deploye.
  const homeSource = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
  const splashSource = readFileSync(new URL('../components/SplashScreen.tsx', import.meta.url), 'utf8');
  assert.match(homeSource, /import \{ version \} from ['"]@\/package\.json['"]/);
  assert.match(homeSource, /version=\{version\}/);
  assert.match(splashSource, /version\?: string/);
  assert.match(splashSource, /\{version && \(/);
  assert.match(splashSource, /v\{version\}/);
  // Pas affiche sur l'usage post-connexion (app/dashboard/page.tsx) : pas
  // de prop `version` passee la-bas.
  const dashboardSource = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
  const dashboardSplashUsage = dashboardSource.slice(
    dashboardSource.indexOf('<SplashScreen'),
    dashboardSource.indexOf('<SplashScreen') + 200
  );
  assert.doesNotMatch(dashboardSplashUsage, /version=/);
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
