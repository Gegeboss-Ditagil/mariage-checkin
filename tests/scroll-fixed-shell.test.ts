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
];

test("chaque ecran principal est ancre au viewport reel (position fixed + inset-0) plutot que seulement dimensionne par h-dvh, sans changer le flex interne (BottomNav garde sa place, aucun padding a ajouter)", () => {
  for (const relPath of LANDSCAPE_SHELL_PAGES) {
    const source = readFileSync(new URL(relPath, import.meta.url), 'utf8');
    assert.match(source, /className="fixed inset-0 flex flex-col overflow-hidden landscape:flex-row"/, relPath);
  }
});
