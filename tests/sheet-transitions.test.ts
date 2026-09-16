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
