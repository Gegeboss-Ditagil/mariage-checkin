import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { isBenignViewTransitionRejection } from '../lib/viewTransitionNoise.ts';

// v1.63.0, retour de Gersom — "quand je change de page rapidement, quand je
// clique partout, des fois je vois des flashs et parfois ça se fige et ça se
// déconnecte." Recoupement avec `app_logs` (v1.54.0) : 7 des 10 dernières
// lignes avant ce correctif étaient exactement ce bruit — le navigateur
// annule lui-même (skipTransition()) une View Transition encore en vol dès
// qu'une nouvelle démarre pendant qu'elle anime (exactement ce qui arrive en
// cliquant/naviguant vite plusieurs fois de suite), et la promesse rejetée
// qui en résulte remontait jusqu'ici comme une vraie `error` dans
// `components/GlobalErrorLogger.tsx` — jamais un bug, mais du bruit qui
// noyait les signaux réels (dont la vraie timeout corrigée en v1.62.0) et
// déclenchait un envoi réseau (`sendBeacon`) exactement pendant la fenêtre
// où un clic rapide peut déjà faire flasher l'écran.

test('reconnait les deux messages de rejet benins observes dans app_logs', () => {
  assert.equal(isBenignViewTransitionRejection('Skipping view transition because skipTransition() was called.'), true);
  assert.equal(isBenignViewTransitionRejection('View transition was skipped because document visibility state is hidden.'), true);
});

test('ne reconnait jamais la vraie timeout corrigee en v1.62.0, ni une erreur de bundle perime', () => {
  assert.equal(isBenignViewTransitionRejection('View transition update callback timed out.'), false);
  assert.equal(isBenignViewTransitionRejection('Loading chunk 42 failed.'), false);
  assert.equal(isBenignViewTransitionRejection('Failed to fetch dynamically imported module'), false);
});

test('tolere une entree vide/absente sans jamais planter', () => {
  assert.equal(isBenignViewTransitionRejection(undefined), false);
  assert.equal(isBenignViewTransitionRejection(null), false);
  assert.equal(isBenignViewTransitionRejection(''), false);
});

const globalErrorLoggerSource = readFileSync(new URL('../components/GlobalErrorLogger.tsx', import.meta.url), 'utf8');

test('components/GlobalErrorLogger.tsx court-circuite le rejet benin AVANT reportClientError, et appelle preventDefault', () => {
  assert.match(
    globalErrorLoggerSource,
    /import \{ isBenignViewTransitionRejection \} from '@\/lib\/viewTransitionNoise';/
  );
  const onRejectionBlock = globalErrorLoggerSource.slice(
    globalErrorLoggerSource.indexOf('function onRejection'),
    globalErrorLoggerSource.lastIndexOf('}')
  );
  const guardIndex = onRejectionBlock.indexOf('isBenignViewTransitionRejection(message)');
  const reportIndex = onRejectionBlock.indexOf('reportClientError({');
  assert.ok(guardIndex > -1 && reportIndex > -1 && guardIndex < reportIndex, 'le garde doit precede reportClientError');
  assert.match(onRejectionBlock, /isBenignViewTransitionRejection\(message\)\) \{\s*event\.preventDefault\(\);\s*return;/);
});

test("ne touche jamais au chemin onError (la journalisation d'une vraie erreur reste inconditionnelle)", () => {
  const onErrorBlock = globalErrorLoggerSource.slice(
    globalErrorLoggerSource.indexOf('function onError'),
    globalErrorLoggerSource.indexOf('function onRejection')
  );
  assert.doesNotMatch(onErrorBlock, /isBenignViewTransitionRejection/);
  assert.match(onErrorBlock, /reportClientError\(\{/);
});
