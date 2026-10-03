import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// v1.64.0, retour de Gersom (message vocal + capture d'écran `/agenda`) :
// (1) « quand j'appuie sur les cartes... le clavier apparaît, c'est pas
// normal. Il y avait déjà ce problème avant » ; (2) « pour les éléments
// privés... change la couleur... le directeur comprend rapidement sans
// avoir à cliquer sur la carte » ; (3) « si mon nom est sur une tâche...
// je veux que la couleur soit différente pour moi » (ex. Scotty assigné
// de 17h à 17h30).

const apiSource = readFileSync(new URL('../app/api/agenda/route.ts', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../app/agenda/page.tsx', import.meta.url), 'utf8');

test('GET /api/agenda renvoie currentUserId pour tout role autorise (viewAgenda), avant tout filtrage canManage', () => {
  assert.match(apiSource, /currentUserId: user\.id/);
});

test("assignedToMe ne compare que assignee_ids (comptes reels), jamais custom_assignees (noms libres)", () => {
  const match = pageSource.match(/const assignedToMe = (.+);/);
  assert.ok(match, 'assignedToMe doit etre calcule explicitement par item');
  assert.match(match![1], /item\.assignee_ids\.includes\(currentUserId\)/);
  assert.doesNotMatch(match![1], /custom_assignees/);
});

test('la carte applique un fond/bordure distincts pour un element prive, prioritaire sur assignedToMe', () => {
  assert.match(pageSource, /item\.is_private\s*\n?\s*\?\s*'border-2 border-accent\/40 bg-accent-tint'/);
  assert.match(pageSource, /:\s*assignedToMe && 'border-2 border-status-complete\/40 bg-status-complete\/5'/);
});

test('un badge "Vous êtes assigné" distinct reste visible meme quand la carte est aussi privee (redondance texte+couleur)', () => {
  assert.match(pageSource, /\{assignedToMe && <span[^>]*>Vous êtes assigné<\/span>\}/);
  // Le badge assigne doit apparaitre dans le JSX avant le badge Prive, les
  // deux independants l'un de l'autre (jamais un `else`).
  const assignedIndex = pageSource.indexOf('Vous êtes assigné');
  const privateIndex = pageSource.indexOf('>Privé<');
  assert.ok(assignedIndex > -1 && privateIndex > -1 && assignedIndex < privateIndex);
});

test('openEditing differe le montage de la fiche (setTimeout) apres le blur, uniquement a l\'ouverture (jamais a la fermeture)', () => {
  const fn = pageSource.slice(pageSource.indexOf('function openEditing'), pageSource.indexOf('function openInsertAt'));
  assert.match(fn, /if \(item === null\) \{\s*setEditing\(null\);\s*return;\s*\}/);
  assert.match(fn, /setTimeout\(\(\) => setEditing\(item\), 0\)/);
  // La fermeture (item === null) ne doit jamais passer par le setTimeout.
  const closeBlock = fn.slice(0, fn.indexOf('return;'));
  assert.doesNotMatch(closeBlock, /setTimeout/);
});

test("openInsertAt differe aussi le montage de la fiche d'ajout", () => {
  const fn = pageSource.slice(pageSource.indexOf('function openInsertAt'), pageSource.indexOf('const load ='));
  assert.match(fn, /setTimeout\(\(\) => setInsertAt\(sortOrder\), 0\)/);
});
