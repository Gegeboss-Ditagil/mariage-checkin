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
// v1.58.0 : la detection/reconnexion ont ete extraites dans lib/staleDeployment.ts
// pour etre partagees avec components/GlobalErrorLogger.tsx -- voir plus bas.
const staleDeploymentSource = readFileSync(new URL('../lib/staleDeployment.ts', import.meta.url), 'utf8');
const globalErrorLoggerSource = readFileSync(new URL('../components/GlobalErrorLogger.tsx', import.meta.url), 'utf8');

test('lib/staleDeployment.ts ne force une reconnexion QUE pour une vraie erreur de chunk/module perime, jamais pour une erreur de rendu quelconque', () => {
  assert.match(staleDeploymentSource, /function isStaleDeploymentError/);
  assert.match(staleDeploymentSource, /ChunkLoadError/);
  assert.match(staleDeploymentSource, /Loading chunk/);
  assert.match(staleDeploymentSource, /dynamically imported module/i);
});

test('app/error.tsx propose "Réessayer" (reset) pour une erreur non liee a un deploiement, sans jamais appeler /api/auth/logout au premier rendu', () => {
  assert.match(source, /import \{ isStaleDeploymentError, reconnectAfterStaleDeployment \} from '@\/lib\/staleDeployment';/);
  // Le fetch de deconnexion ne doit etre atteignable QUE derriere le garde
  // `if (staleDeployment)`, jamais inconditionnellement au montage.
  const effectBlock = source.slice(source.indexOf('useEffect(() => {'), source.indexOf('}, [staleDeployment]);'));
  assert.match(effectBlock, /if \(staleDeployment\) void reconnectAfterStaleDeployment\(\);/);
  assert.match(source, /onClick=\{reset\}/, 'un bouton doit relancer le rendu via reset() sans toucher a la session');
  assert.match(source, /Réessayer/);
});

test('app/error.tsx garde un chemin de secours manuel vers la reconnexion, pour l\'utilisateur qui le demande explicitement', () => {
  assert.match(source, /Se reconnecter à la place/);
  assert.match(staleDeploymentSource, /async function reconnectAfterStaleDeployment\(\)/);
  assert.match(staleDeploymentSource, /fetch\('\/api\/auth\/logout'/);
});

// v1.58.0 : bug reel trouve en creusant un signalement de freeze/"jamais
// redemande de login" -- une erreur de bundle perime survenant dans un
// callback ASYNCHRONE (ex: le callback de mise a jour d'un
// `document.startViewTransition`) ne remonte jamais a app/error.tsx (un
// error boundary React ne capture que les erreurs de rendu synchrones) --
// seuls les ecouteurs globaux de GlobalErrorLogger la voient, et se
// contentaient jusqu'ici de la journaliser sans jamais reconnecter.
test('components/GlobalErrorLogger.tsx force aussi la reconnexion sur une erreur de bundle perime vue par window.onerror/unhandledrejection', () => {
  assert.match(globalErrorLoggerSource, /import \{ isStaleDeploymentError, reconnectAfterStaleDeployment \} from '@\/lib\/staleDeployment';/);
  assert.match(globalErrorLoggerSource, /isStaleDeploymentError\(\{ name: event\.error\?\.name, message: event\.message \}\)/);
  assert.match(globalErrorLoggerSource, /isStaleDeploymentError\(\{ name: reason instanceof Error \? reason\.name : undefined, message \}\)/);
  // Mais la journalisation reste inconditionnelle : meme une erreur qui
  // declenche la reconnexion doit rester visible dans app_logs.
  const onErrorBlock = globalErrorLoggerSource.slice(globalErrorLoggerSource.indexOf('function onError'), globalErrorLoggerSource.indexOf('function onRejection'));
  assert.match(onErrorBlock, /reportClientError\(\{/);
  assert.match(onErrorBlock, /reportClientError\({[\s\S]*?}\);\s*if \(isStaleDeploymentError/, 'reportClientError doit s\'executer avant le garde de reconnexion, jamais a sa place');
});
