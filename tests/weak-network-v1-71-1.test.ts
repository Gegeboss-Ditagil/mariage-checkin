import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isViewTransitionTimeout, VIEW_TRANSITION_GUARD_SCRIPT, VIEW_TRANSITION_OFF_KEY } from '../lib/viewTransitionGuard.ts';

// v1.71.1 -- réseau faible sur place : « View transition update callback
// timed out » (écran figé jusqu'à ~4 s) relevé à répétition dans app_logs.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('reconnaît uniquement l erreur d expiration de View Transition', () => {
  assert.ok(isViewTransitionTimeout('View transition update callback timed out.'));
  assert.ok(!isViewTransitionTimeout('Skipping view transition because skipTransition() was called.'));
  assert.ok(!isViewTransitionTimeout(undefined));
});

function runGuard(stored: string | null, connection: Record<string, unknown> | undefined): boolean {
  const proto: Record<string, unknown> = { startViewTransition: () => undefined };
  const fn = new Function('sessionStorage', 'navigator', 'Document', VIEW_TRANSITION_GUARD_SCRIPT);
  fn({ getItem: (k: string) => (k === VIEW_TRANSITION_OFF_KEY ? stored : null) }, { connection }, { prototype: proto });
  return 'startViewTransition' in proto;
}

test('script de garde : transitions coupées si déjà expirées dans la session ou réseau lent, gardées sinon', () => {
  assert.equal(runGuard(null, undefined), true, 'iPhone (pas d API réseau), aucune expiration : transitions gardées');
  assert.equal(runGuard('1', undefined), false, 'déjà expirée dans la session : coupées');
  assert.equal(runGuard(null, { effectiveType: '3g' }), false, '3G : coupées');
  assert.equal(runGuard(null, { effectiveType: 'slow-2g' }), false, '2G lente : coupées');
  assert.equal(runGuard(null, { saveData: true, effectiveType: '4g' }), false, 'économie de données : coupées');
  assert.equal(runGuard(null, { effectiveType: '4g' }), true, '4G : gardées');
});

test('branché : script dans <head> avant hydratation, coupure à la première expiration', () => {
  const layout = read('../app/layout.tsx');
  assert.match(layout, /<script dangerouslySetInnerHTML=\{\{ __html: VIEW_TRANSITION_GUARD_SCRIPT \}\} \/>\s*\r?\n\s*<\/head>/);
  const logger = read('../components/GlobalErrorLogger.tsx');
  assert.match(logger, /if \(isViewTransitionTimeout\(message\)\) disableViewTransitions\(true\);/);
});
