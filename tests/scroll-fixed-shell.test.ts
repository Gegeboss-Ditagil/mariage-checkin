import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Retour de Gersom le 13/09/2026 (capture d'écran Agent001 sur /scan) :
// "j'appuie sur le bouton [de] la barre... et je scroll vers le haut vers
// le bas, ça fait bugger un peu l'application, ça ne reste pas figé...
// après quand je vais récliquer au milieu, ça fait comme si je suis en
// train d'interagir avec la grande fenêtre et je ne peux pas cliquer dans
// l'élément au milieu... Make it really fixed like in an app."
//
// Deux causes réelles trouvées, corrigées ensemble :
// 1. `hooks/usePullToRefresh.ts` gardait "seulement en haut de page" avec
//    `window.scrollY <= 0` -- structurellement toujours vrai dans cette
//    app (html/body ne défilent jamais, seul un `<div overflow-y-auto>`
//    interne défile) : le garde-fou ne protégeait donc jamais rien, et
//    l'indicateur "tirer pour actualiser" pouvait se déclencher (et rester
//    bloqué, faute de `touchcancel`) au milieu d'un défilement normal,
//    décalant la mise en page sous lui.
// 2. La coquille de chaque page (`h-dvh` seul) peut se recalculer avec un
//    léger décalage pendant qu'une barre d'outils système (Safari iOS)
//    apparaît/disparaît en cours de défilement -- `fixed inset-0` ancre
//    chaque page au viewport réel, sans dépendre de ce recalcul.

const pullToRefreshHook = readFileSync(new URL('../hooks/usePullToRefresh.ts', import.meta.url), 'utf8');
const dashboardPage = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');
const planTablePage = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');

test("usePullToRefresh verifie le scrollTop du conteneur reel (containerRef), plus jamais window.scrollY qui restait toujours a 0", () => {
  assert.match(pullToRefreshHook, /containerRef\?: RefObject<HTMLElement \| null>/);
  assert.match(pullToRefreshHook, /function atTop\(\) \{/);
  assert.match(pullToRefreshHook, /containerRef\.current\?\.scrollTop \?\? 0\) <= 0/);
  // Filet si un futur appelant n'a pas encore de containerRef : comportement
  // d'avant, jamais une regression silencieuse d'un appelant existant.
  assert.match(pullToRefreshHook, /: window\.scrollY <= 0/);
});

test("usePullToRefresh ignore le pincement (multi-doigts) et se reinitialise proprement sur touchcancel (geste repris par le systeme), au lieu de rester bloque", () => {
  assert.match(pullToRefreshHook, /e\.touches\.length === 1 && atTop\(\)/);
  assert.match(pullToRefreshHook, /if \(e\.touches\.length > 1\) \{\s*\n\s*reset\(\);/);
  assert.match(pullToRefreshHook, /function onTouchCancel\(\) \{\s*\n\s*reset\(\);/);
  assert.match(pullToRefreshHook, /window\.addEventListener\('touchcancel', onTouchCancel/);
});

test('/dashboard passe son propre conteneur defilant (scrollRef) a usePullToRefresh, au lieu de laisser le hook se fier a window.scrollY', () => {
  assert.match(dashboardPage, /const scrollRef = useRef<HTMLDivElement>\(null\);/);
  assert.match(dashboardPage, /<div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto/);
  assert.match(dashboardPage, /usePullToRefresh\(load, scrollRef\)/);
});

test("/plan-table (deja corrige le meme jour pour le pincement) gagne aussi onTouchCancel : un geste repris par le systeme reinitialise sans jamais declencher le rafraichissement", () => {
  const touchCancelBlock = planTablePage.slice(planTablePage.indexOf('function onTouchCancel'), planTablePage.indexOf('const invitationsByTable'));
  assert.match(touchCancelBlock, /touchStartY\.current = null;/);
  assert.match(touchCancelBlock, /setPull\(0\);/);
  assert.doesNotMatch(touchCancelBlock, /doRefresh\(\)/);
  assert.match(planTablePage, /onTouchCancel={onTouchCancel}/);
});

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
  // v1.69.2 : ces deux ecrans (ajoutes apres v1.67.13, jamais migres vers ce
  // patron) gardaient l'ancien `fixed inset-0` sans `landscape:flex-row` --
  // en paysage, les classes `landscape:h-full landscape:w-20` propres a
  // BottomNav (pensees pour un parent `flex-row`) se retrouvaient a l'interieur
  // d'un parent reste `flex-col`, et la barre occupait alors presque toute la
  // hauteur restante en une bande etroite, ecrasant le contenu de la page a un
  // sliver quasi invisible (retour de Gersom, capture d'ecran /mon-mot-de-passe).
  '../app/mon-mot-de-passe/page.tsx',
  '../app/mots-de-passe/page.tsx',
];

test("chaque ecran principal est ancre au viewport reel (position fixed + hauteur explicite 100svh) plutot que seulement dimensionne par h-dvh, sans changer le flex interne (BottomNav garde sa place, aucun padding a ajouter)", () => {
  for (const relPath of LANDSCAPE_SHELL_PAGES) {
    const source = readFileSync(new URL(relPath, import.meta.url), 'utf8');
    assert.match(
      source,
      /className="fixed inset-x-0 top-0 flex h-\[100svh\] flex-col overflow-hidden bg-bg landscape:flex-row landscape:h-\[calc\(100svh-env\(safe-area-inset-bottom\)\)\]"/,
      relPath
    );
  }
});

// v1.67.3, retour de Gersom (2 captures d'écran, navigateur mobile NON
// installé -- `/scan` et `/admin/users`) : "quand on est sur un browser,
// ajuste pour que justement tout fait sur un écran. Là, je vois que le
// dernier élément, il est coupé... et sur toutes les pages." Root cause :
// `fixed inset-0` (v1.45.0 ci-dessus) laisse le navigateur calculer la
// hauteur automatiquement a partir du haut ET du bas (top:0, bottom:0) --
// pour un element `position: fixed` sans hauteur explicite, Safari mobile
// resout cet "auto" contre le GRAND viewport (barre d'adresse + barre
// d'outils EN BAS supposees deja repliees), jamais contre la zone REELLEMENT
// visible quand ces barres sont affichees (onglet de navigateur ordinaire,
// jamais installe en PWA) -- exactement le classique bug `100vh` mobile,
// reintroduit ici via l'auto-height de `inset-0` plutot que via un `100vh`
// explicite. Le dernier element du flex (BottomNav) se retrouve alors
// physiquement sous la vraie barre d'outils du navigateur, dans la zone que
// `overflow-hidden` empeche de jamais faire defiler jusque-la. Corrige en
// remplacant l'auto-height de `inset-0` par une hauteur EXPLICITE
// `h-[100svh]` (petit viewport -- la plus petite zone garantie visible,
// barres d'outils supposees deployees) : jamais plus grand que ce qui est
// reellement visible, donc plus jamais de contenu cache sous le navigateur.
// Deliberement `svh` et PAS `dvh` (qui se recalcule dynamiquement pendant le
// defilement quand les barres se replient/deploient) : `dvh` reintroduirait
// exactement le probleme que `fixed inset-0` avait corrige en v1.45.0 (la
// coquille qui bouge legerement en cours de geste, rendant le bouton central
// momentanement injoignable) -- `svh` est une valeur STATIQUE, jamais
// recalculee en cours d'interaction, qui cumule donc les deux proprietes :
// jamais trop grand (correctif de ce lot) ET jamais instable (acquis de
// v1.45.0, preserve). En mode PWA installee, petit et grand viewport sont
// identiques (aucune barre de navigateur reelle) : aucun changement de
// comportement pour ce cas deja fonctionnel.
test("chaque ecran principal utilise une hauteur explicite 100svh (petit viewport, jamais plus grand que la zone reellement visible derriere un navigateur non installe) plutot que l'auto-height de inset-0 seul, et jamais 100dvh (qui se recalculerait en cours de defilement, regression de v1.45.0)", () => {
  for (const relPath of LANDSCAPE_SHELL_PAGES) {
    const source = readFileSync(new URL(relPath, import.meta.url), 'utf8');
    assert.match(source, /h-\[100svh\]/, relPath);
    assert.doesNotMatch(source, /h-\[100dvh\]/, relPath + ' ne doit jamais utiliser dvh (recalcul instable pendant le defilement, regression de v1.45.0)');
  }
});

// v1.53.9, retour de Gersom : "quand je navigue entre les differentes pages
// de l'application, j'ai toujours un petit flash d'une page blanche...
// surtout au debut, apres ca ameliore" -- parcours systematique des 11
// ecrans principaux (tableau de bord et toutes ses destinations
// BottomNav), en comparant avec les ecrans de detail (tables/[tableId],
// checkin/[invitationId]...) qui n'ont jamais ce symptome. Difference
// trouvee : ces 11 ecrans (et eux seuls) utilisent `position: fixed`
// (v1.45.0 ci-dessus) sans jamais poser de `background-color` directement
// sur ce conteneur -- ils comptaient uniquement sur `body { @apply bg-bg }`
// pour etre opaques. Un element `fixed` obtient sa propre couche de
// composition cote navigateur (particulierement WebKit/iOS en PWA
// standalone) ; sans couleur de fond posee SUR cette couche precise, le
// navigateur peut la peindre en blanc le temps d'un ou deux frames pendant
// une transition, meme si `body` est bien opaque en dessous -- "s'ameliore
// avec le temps" correspond au moteur qui finit par mettre en cache la
// couche de chaque route deja visitee. Corrige a deux niveaux : `bg-bg`
// directement sur le conteneur `fixed inset-0` de chacun des 11 ecrans
// (verrouille ci-dessus, remplace l'ancienne classe sans fond), et
// `background-color: var(--bg)` pose explicitement en CSS sur `html`/`body`
// (app/globals.css), pas seulement via la classe Tailwind `bg-bg` sur
// `body` -- filet redondant, low-cost, qui ne depend d'aucun ordre de
// calcul de classes.
test("html et body posent explicitement background-color (pas seulement via la classe Tailwind bg-bg), pour combler le trou de couche de composition WebKit sur les ecrans fixed", () => {
  const globalsCss = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const htmlBodyBlock = globalsCss.slice(globalsCss.indexOf('html, body {'), globalsCss.indexOf('\n}', globalsCss.indexOf('html, body {')));
  assert.match(htmlBodyBlock, /background-color: var\(--bg\);/);
});

// Retour de Gersom le 13/09/2026 (deuxième signalement, /plan-table tourné
// en paysage sur iPad) : "à déréguler ce problème de app fixé même quand on
// met en horizontal" -- le dernier contenu visible (dernière rangée de
// tables) se retrouvait recouvert par la barre gestuelle système (home
// indicator), qui reste horizontale au bas de l'écran même en paysage sur
// iPad (contrairement à l'iPhone, où elle rejoint un des côtés). Portrait
// n'a jamais ce problème (`.bottom-nav-glass` réserve déjà cette place via
// `margin-bottom`), mais en paysage cette marge est explicitement remise à
// 0 (la barre devient une bande verticale, avec seulement `safe-right`
// contre l'encoche/coin arrondi de CE côté) -- rien ne protégeait le bord
// du BAS. Probablement masqué avant `fixed inset-0` (v1.45.0) par un calcul
// de `h-dvh` qui excluait déjà cette zone sur certains navigateurs ;
// exposé une fois le viewport réel utilisé directement. Corrigé en
// réduisant le rectangle de la coquille elle-même en paysage (`bottom`
// plutôt que `0`), qui protège d'un coup le contenu ET le dernier onglet
// de la bande verticale, sans toucher au padding interne d'aucune des 11
// pages.
//
// v1.67.3 : `landscape:bottom-[env(...)]` est devenu sans effet une fois la
// hauteur fixée explicitement (`top` + `height` tous deux spécifiés force le
// moteur CSS à ignorer `bottom`, qui ne fait plus que participer au calcul
// si l'un des deux autres est `auto`) -- remplacé par un ajustement
// équivalent de la HAUTEUR elle-même en paysage (`landscape:h-[calc(100svh-env(safe-area-inset-bottom))]`,
// verrouillé par le test précédent), même effet (la coquille laisse la même
// marge en bas), toujours actif.
test("en paysage, la coquille de chaque page reserve aussi l'espace du bas (env(safe-area-inset-bottom)) via la hauteur elle-meme -- la barre gestuelle systeme (iPad) reste horizontale meme tourne, rien ne la protegeait avant", () => {
  for (const relPath of LANDSCAPE_SHELL_PAGES) {
    const source = readFileSync(new URL(relPath, import.meta.url), 'utf8');
    assert.match(source, /landscape:h-\[calc\(100svh-env\(safe-area-inset-bottom\)\)\]/, relPath);
  }
});
