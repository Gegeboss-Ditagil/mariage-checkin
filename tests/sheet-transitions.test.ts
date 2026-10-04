import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.53.18, retour de Gersom (16/09/2026) : "corrige fluidifie" les
// transitions des panneaux modaux (fiche d'approbation, camera, "Invite
// surprise", selecteur de responsables, activite d'agenda, aide
// d'installation) -- jusque-la ces panneaux apparaissaient/disparaissaient
// d'un coup (montage/demontage React instantane, aucune animation de
// sortie). `hooks/useDismiss.ts` centralise le cycle "jouer l'animation de
// sortie PUIS demonter" pour tous ces panneaux (voir app/globals.css pour
// les classes .sheet-panel/.sheet-card/.sheet-backdrop).

const hookSource = readFileSync(new URL('../hooks/useDismiss.ts', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('useDismiss expose closing/dismiss et respecte prefers-reduced-motion', () => {
  assert.match(hookSource, /export function useDismiss\(onClose: \(\) => void\)/);
  assert.match(hookSource, /useState\(false\)/);
  assert.match(hookSource, /setTimeout/);
  assert.match(hookSource, /prefers-reduced-motion: reduce/);
  // Le vrai onClose n'est jamais appele avant la fin de l'animation (sauf
  // en reduced-motion, ou le delai tombe a 0) -- jamais un demontage net.
  assert.match(hookSource, /onCloseRef\.current\(\)/);
});

// v1.67.1, bug réel signalé par Gersom (capture d'écran /agenda) : "la fiche
// pour modifier l'activité va sortir... après ça va être fermé... après ça
// bug, je ne suis plus capable d'appuyer sur rien." Root cause : `closing`
// n'était jamais remis à `false` après le timer de sortie -- pour un
// consommateur PERSISTANT qui rouvre/referme le même panneau plusieurs fois
// sans jamais démonter le composant entier (AgendaPage, /approbations,
// InstallAppButton -- tous les trois un simple state interne, `useDismiss`
// appelé une seule fois pour toute la vie du composant), `closing` restait
// collé à `true` dès la toute première fermeture : la réouverture suivante
// remontait directement en classes "-closing" (opacity 0 via `animation:
// ... both`, jamais démonté) -- invisible mais toujours en `fixed inset-0
// z-50`, bloquant tout le reste de l'écran, ET `dismiss()` refusait alors
// de rouvrir le cycle (`if (closing) return;`, déjà vrai) : le bouton de
// fermeture devenait un no-op silencieux, aucune sortie possible sans
// recharger la page. Les consommateurs démontés entièrement entre deux
// ouvertures (GuestApprovalCaptureFlow/PhotoCaptureCamera/ResponsablePicker,
// `onClose` reçu en prop d'un parent qui conditionne leur montage) n'étaient
// jamais touchés -- un nouvel appel à `useDismiss` repart de `closing=false`.
test("useDismiss remet closing à false après le timer de sortie -- jamais collé à true après le tout premier cycle ouverture/fermeture", () => {
  const timerBlock = hookSource.slice(hookSource.indexOf('timerRef.current = setTimeout'));
  // setClosing(false) doit survenir APRES onCloseRef.current(), dans le
  // meme callback de timeout -- jamais avant, et jamais absent.
  const closeIdx = timerBlock.indexOf('onCloseRef.current()');
  const resetIdx = timerBlock.indexOf('setClosing(false)');
  assert.ok(closeIdx >= 0, 'onCloseRef.current() doit rester appelé dans le timer');
  assert.ok(resetIdx > closeIdx, 'setClosing(false) doit suivre onCloseRef.current(), jamais le precéder ni être absent');
});

test('filet de sécurité CSS : un panneau "-closing" ne peut plus jamais intercepter un tap, quelle que soit la cause d\'un futur blocage similaire', () => {
  for (const cls of ['.sheet-panel-closing', '.sheet-card-closing', '.sheet-backdrop-closing']) {
    const block = cssSource.slice(cssSource.indexOf(cls), cssSource.indexOf(cls) + 200);
    assert.match(block, /pointer-events:\s*none/, cls + ' doit poser pointer-events: none');
  }
});

test('globals.css definit les classes sheet-panel/sheet-card/sheet-backdrop (entree et sortie) avec un garde reduced-motion', () => {
  assert.match(cssSource, /@keyframes sheet-panel-in/);
  assert.match(cssSource, /@keyframes sheet-panel-out/);
  assert.match(cssSource, /@keyframes sheet-card-in/);
  assert.match(cssSource, /@keyframes sheet-card-out/);
  assert.match(cssSource, /@keyframes sheet-backdrop-in/);
  assert.match(cssSource, /@keyframes sheet-backdrop-out/);
  assert.match(cssSource, /\.sheet-panel\s*\{/);
  assert.match(cssSource, /\.sheet-panel-closing\s*\{/);
  assert.match(cssSource, /\.sheet-card\s*\{/);
  assert.match(cssSource, /\.sheet-card-closing\s*\{/);
  assert.match(cssSource, /\.sheet-backdrop\s*\{/);
  assert.match(cssSource, /\.sheet-backdrop-closing\s*\{/);
  // Le garde reduced-motion des classes "sheet-*" doit desactiver les six
  // classes, pas seulement les view transitions de page deja gardees plus haut.
  const guardMatches = cssSource.match(/@media \(prefers-reduced-motion: reduce\) \{[^}]*\.sheet-panel,[\s\S]*?\}\s*\}/);
  assert.ok(guardMatches, 'un bloc prefers-reduced-motion doit desactiver les classes sheet-*');
});

const fullScreenPanels = [
  { path: '../components/GuestApprovalCaptureFlow.tsx', label: 'GuestApprovalCaptureFlow' },
  { path: '../components/PhotoCaptureCamera.tsx', label: 'PhotoCaptureCamera' },
  { path: '../components/ResponsablePicker.tsx', label: 'ResponsablePicker' },
];

for (const { path, label } of fullScreenPanels) {
  test(label + ' utilise useDismiss et anime son panneau plein ecran (sheet-panel/-closing)', () => {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /import \{ useDismiss \} from '@\/hooks\/useDismiss';/);
    assert.match(source, /useDismiss\(onClose\)/);
    assert.match(source, /closing \? 'sheet-panel-closing' : 'sheet-panel'/);
    // Chaque appel de fermeture passe par dismiss(), plus jamais onClose
    // directement (qui demonterait sans jouer l'animation de sortie).
    assert.doesNotMatch(source, /onClick=\{onClose\}/);
  });
}

test('InstallAppButton anime son aide d\'installation (sheet-card + sheet-backdrop)', () => {
  const source = readFileSync(new URL('../components/InstallAppButton.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ useDismiss \} from '@\/hooks\/useDismiss';/);
  assert.match(source, /useDismiss\(\(\) => setShowHelp\(false\)\)/);
  assert.match(source, /helpClosing \? 'sheet-backdrop-closing' : 'sheet-backdrop'/);
  assert.match(source, /helpClosing \? 'sheet-card-closing' : 'sheet-card'/);
  assert.doesNotMatch(source, /onClick=\{\(\) => setShowHelp\(false\)\}/);
});

test('/approbations anime la fiche detaillee (sheet-card + sheet-backdrop), Echap et le fond inclus', () => {
  const source = readFileSync(new URL('../app/approbations/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ useDismiss \} from '@\/hooks\/useDismiss';/);
  assert.match(source, /useDismiss\(\(\) => setSelectedId\(null\)\)/);
  assert.match(source, /detailClosing \? 'sheet-backdrop-closing' : 'sheet-backdrop'/);
  assert.match(source, /detailClosing \? 'sheet-card-closing' : 'sheet-card'/);
  assert.match(source, /if \(event\.key === 'Escape'\) dismissDetail\(\);/);
  assert.doesNotMatch(source, /setSelectedId\(null\)\}(?!\))/);
});

test('/agenda anime ses deux modales (nouvelle activite, modifier) en sheet-card + sheet-backdrop', () => {
  const source = readFileSync(new URL('../app/agenda/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /import \{ useDismiss \} from '@\/hooks\/useDismiss';/);
  assert.match(source, /useDismiss\(\(\) => setInsertAt\(null\)\)/);
  assert.match(source, /useDismiss\(\(\) => openEditing\(null\)\)/);
  assert.match(source, /insertClosing \? 'sheet-backdrop-closing' : 'sheet-backdrop'/);
  assert.match(source, /insertClosing \? 'sheet-card-closing' : 'sheet-card'/);
  assert.match(source, /editClosing \? 'sheet-backdrop-closing' : 'sheet-backdrop'/);
  assert.match(source, /editClosing \? 'sheet-card-closing' : 'sheet-card'/);
  assert.match(source, /<ModalHeader title="Nouvelle activité" onClose=\{dismissInsert\} \/>/);
  assert.match(source, /<ModalHeader title="Modifier l’activité" onClose=\{dismissEdit\} \/>/);
});
