import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Retour de Gersom le 17/09/2026 (3 captures d'écran /agenda). (1) La flèche
// ">" de "Choisir les responsables" n'était pas alignée à droite -- root
// cause : `.action-row`/`.action-row-muted` déclarent `block`/`text-center`
// et étaient écrites APRÈS `@tailwind utilities` sans `@layer` (aucun dans
// tout ce fichier) donc APRÈS dans la feuille finale -- à spécificité égale,
// ça gagnait sur les utilitaires `flex`/`items-center`/`text-left` ajoutés en
// plus dans le `className` (5 usages : app/agenda/page.tsx x2,
// components/ResponsablePicker.tsx x3), faisant retomber le bouton en bloc
// centré. (2) Le clavier/roulette natif ("l'option pour sélectionner
// l'heure qui pop... ce n'est pas normal... je dois swipe down et
// refresh") apparaissait sans qu'aucun champ n'ait été touché.
const globalStyles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const agendaPage = readFileSync(new URL('../app/agenda/page.tsx', import.meta.url), 'utf8');
const useDismissSource = readFileSync(new URL('../hooks/useDismiss.ts', import.meta.url), 'utf8');

test(".action-row et .action-row-muted sont dans @layer components pour que flex/items-center/text-left (ajoutes en plus dans le className) gardent la priorite sur leur propre block/text-center", () => {
  const componentsLayerMatch = globalStyles.match(/@layer components \{([\s\S]*?)\n\}/);
  assert.ok(componentsLayerMatch, '@layer components introuvable dans globals.css');
  const body = componentsLayerMatch![1];
  assert.match(body, /\.action-row \{/);
  assert.match(body, /\.action-row-muted \{/);
});

test("le champ Titre de \"Nouvelle activite\" n'a plus autoFocus -- le clavier n'apparait que si le champ est reellement touche", () => {
  assert.doesNotMatch(agendaPage, /autoFocus/);
});

test("openEditing/openInsertAt retirent le focus actif avant d'ouvrir une nouvelle fiche (evite qu'un clavier/roulette natif d'un champ precedent ne reapparaisse)", () => {
  const openEditingMatch = agendaPage.match(/function openEditing\([\s\S]*?\n  \}/);
  const openInsertAtMatch = agendaPage.match(/function openInsertAt\([\s\S]*?\n  \}/);
  assert.ok(openEditingMatch, 'openEditing introuvable');
  assert.ok(openInsertAtMatch, 'openInsertAt introuvable');
  assert.match(openEditingMatch![0], /document\.activeElement as HTMLElement \| null\)\?\.blur\?\.\(\)/);
  assert.match(openInsertAtMatch![0], /document\.activeElement as HTMLElement \| null\)\?\.blur\?\.\(\)/);
});

test('useDismiss retire le focus actif avant de demonter le panneau (meme garde a la fermeture)', () => {
  assert.match(useDismissSource, /document\.activeElement as HTMLElement \| null\)\?\.blur\?\.\(\)/);
  // La garde doit s'executer AVANT setClosing (donc avant le setTimeout qui
  // demonte reellement), pas apres.
  const dismissBody = useDismissSource.match(/function dismiss\(\) \{([\s\S]*?)\n  \}/);
  assert.ok(dismissBody);
  const blurIndex = dismissBody![1].indexOf('.blur?.()');
  const setClosingIndex = dismissBody![1].indexOf('setClosing(true)');
  assert.ok(blurIndex >= 0 && setClosingIndex >= 0 && blurIndex < setClosingIndex);
});
