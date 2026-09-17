import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Retour de Gersom le 17/09/2026 (capture d'écran /agenda) : deux bugs
// distincts. (1) Taper sur une carte pour la modifier fait apparaître le
// clavier mais "ça bug après" -- root cause probable : bug WebKit très
// documenté (fixed position + champ actif + clavier) qui fait sauter les
// panneaux modaux `fixed inset-0` dont les unités `dvh` ne se remettaient
// pas à jour à l'ouverture du clavier en PWA installée. (2) "swipe à partir
// de la gauche vers la droite... seulement si je mets mon doigt vraiment
// sur le bout de l'écran... j'aimerais que ce soit un peu plus intuitif" --
// le geste système iOS a une zone de détection fixe et non réglable ; ce
// projet implémente donc son propre geste, avec une zone plus généreuse.

const layoutSource = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
const swipeBackSource = readFileSync(new URL('../hooks/useSwipeBack.ts', import.meta.url), 'utf8');
const topBarSource = readFileSync(new URL('../components/TopBar.tsx', import.meta.url), 'utf8');

test("le viewport declare interactiveWidget: 'resizes-content' pour que les unites dvh se remettent a jour a l'ouverture du clavier", () => {
  assert.match(layoutSource, /interactiveWidget: 'resizes-content'/);
});

test('useSwipeBack demarre uniquement depuis une zone de bord elargie (32px, plus genereuse que le geste systeme iOS)', () => {
  assert.match(swipeBackSource, /EDGE_ZONE_PX = 32/);
  assert.match(swipeBackSource, /touch\.clientX <= EDGE_ZONE_PX/);
});

test('useSwipeBack ignore un pincement (deux doigts) et un deplacement surtout vertical (defilement normal)', () => {
  assert.match(swipeBackSource, /e\.touches\.length !== 1/);
  assert.match(swipeBackSource, /e\.touches\.length > 1/);
  assert.match(swipeBackSource, /dy > VERTICAL_CANCEL_PX && dy > dx/);
});

test('useSwipeBack se remet a zero sur touchend ET touchcancel (le systeme peut annuler la sequence sans jamais declencher touchend)', () => {
  assert.match(swipeBackSource, /addEventListener\('touchend', onTouchEnd/);
  assert.match(swipeBackSource, /addEventListener\('touchcancel', onTouchCancel/);
});

test('useSwipeBack navigue vers la meme destination que le bouton "‹" -- jamais un simple historique de navigateur', () => {
  assert.match(swipeBackSource, /router\.push\(href\)/);
  assert.doesNotMatch(swipeBackSource, /router\.back\(\)/);
  assert.doesNotMatch(swipeBackSource, /history\.back\(\)/);
});

test('TopBar cable useSwipeBack sur effectiveBackHref (meme cible que la fleche visible, y compris la redirection admin/visibilite vers /dashboard)', () => {
  assert.match(topBarSource, /import \{ useSwipeBack \} from '@\/hooks\/useSwipeBack';/);
  assert.match(topBarSource, /useSwipeBack\(effectiveBackHref\);/);
});
