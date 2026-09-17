import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// v1.53.19, meme lot que tests/session-stability.test.ts. Decouverte en
// auditant le code autour du signalement de Gersom ("deconnexions
// frequentes... surtout en navigant rapidement") : `app/error.tsx` -- le
// filet de secours generique de Next.js pour TOUTE erreur de rendu non
// capturee, n'importe ou dans l'app -- deconnectait et renvoyait au login
// pour N'IMPORTE QUELLE erreur, pas seulement une vraie erreur de bundle
// perime apres un deploiement. Deja documente comme symptome en v1.33.1
// (CHANGELOG.md) : un bug de rendu sans aucun rapport avec la session
// ("un spread sur `undefined` plantait /agenda") avait alors ete corrige au
// cas par cas, sans jamais corriger le filet generique lui-meme -- "d'ou
// l'impression de deconnexions frequentes apres quelques manipulations".

const source = readFileSync(new URL('../app/error.tsx', import.meta.url), 'utf8');

test('app/error.tsx ne force une reconnexion QUE pour une vraie erreur de chunk/module perime, jamais pour une erreur de rendu quelconque', () => {
  assert.match(source, /function isStaleDeploymentError/);
  assert.match(source, /ChunkLoadError/);
  assert.match(source, /Loading chunk/);
  assert.match(source, /dynamically imported module/i);
});

test('app/error.tsx propose "Réessayer" (reset) pour une erreur non liee a un deploiement, sans jamais appeler /api/auth/logout au premier rendu', () => {
  // Le fetch de deconnexion ne doit etre atteignable QUE derriere le garde
  // `if (staleDeployment)`, jamais inconditionnellement au montage.
  const effectBlock = source.slice(source.indexOf('useEffect(() => {'), source.indexOf('}, [staleDeployment]);'));
  assert.match(effectBlock, /if \(staleDeployment\) void reconnect\(\);/);
  assert.match(source, /onClick=\{reset\}/, 'un bouton doit relancer le rendu via reset() sans toucher a la session');
  assert.match(source, /Réessayer/);
});

test('app/error.tsx garde un chemin de secours manuel vers la reconnexion, pour l\'utilisateur qui le demande explicitement', () => {
  assert.match(source, /Se reconnecter à la place/);
  assert.match(source, /async function reconnect\(\)/);
  assert.match(source, /fetch\('\/api\/auth\/logout'/);
});
