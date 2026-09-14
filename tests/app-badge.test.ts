import assert from 'node:assert/strict';
import test from 'node:test';
import { syncAppBadge, clearAppBadge } from '../lib/appBadge.ts';

// v1.48.4, demande de Gersom : "le petit 1 indicateur sur l'icône avant de
// l'ouvrir" -- badge numerique sur l'icone de l'app (Badging API), distinct
// du badge affiche a l'interieur de l'app une fois ouverte. Tests
// comportementaux (pas seulement une inspection du source) : verifient que
// setAppBadge/clearAppBadge sont bien appeles selon le compte, et que
// l'absence de l'API (navigateur non supporte) ne leve jamais d'erreur.

function withNavigatorBadge<T>(impl: { setAppBadge?: unknown; clearAppBadge?: unknown } | undefined, run: () => T): T {
  // Node 21+ expose un `navigator` global en lecture seule (accesseur sans
  // setter) -- on ne peut pas juste faire `globalThis.navigator = ...`,
  // il faut redefinir la propriete elle-meme, puis la restaurer a l'identique.
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  if (impl === undefined) {
    Object.defineProperty(globalThis, 'navigator', { value: undefined, configurable: true, writable: true });
  } else {
    Object.defineProperty(globalThis, 'navigator', { value: impl, configurable: true, writable: true });
  }
  try {
    return run();
  } finally {
    if (original) Object.defineProperty(globalThis, 'navigator', original);
    else delete (globalThis as any).navigator;
  }
}

test('syncAppBadge appelle setAppBadge(count) quand count > 0', () => {
  const calls: number[] = [];
  withNavigatorBadge(
    {
      setAppBadge: async (n?: number) => {
        calls.push(n ?? -1);
      },
      clearAppBadge: async () => {
        calls.push(0);
      },
    },
    () => syncAppBadge(3)
  );
  assert.deepEqual(calls, [3]);
});

test('syncAppBadge appelle clearAppBadge (pas setAppBadge(0)) quand count est 0', () => {
  let setCalled = false;
  let clearCalled = false;
  withNavigatorBadge(
    {
      setAppBadge: async () => {
        setCalled = true;
      },
      clearAppBadge: async () => {
        clearCalled = true;
      },
    },
    () => syncAppBadge(0)
  );
  assert.equal(setCalled, false);
  assert.equal(clearCalled, true);
});

test('clearAppBadge() est un raccourci pour syncAppBadge(0)', () => {
  let clearCalled = false;
  withNavigatorBadge(
    {
      setAppBadge: async () => {},
      clearAppBadge: async () => {
        clearCalled = true;
      },
    },
    () => clearAppBadge()
  );
  assert.equal(clearCalled, true);
});

test('sans la Badging API (navigateur non supporte), aucun appel ne leve -- jamais bloquant', () => {
  assert.doesNotThrow(() => withNavigatorBadge({}, () => syncAppBadge(5)));
  assert.doesNotThrow(() => withNavigatorBadge(undefined, () => syncAppBadge(5)));
});

test("une promesse rejetee par setAppBadge/clearAppBadge n'est jamais une exception non geree", async () => {
  withNavigatorBadge(
    {
      setAppBadge: async () => {
        throw new Error('non supporte dans ce contexte');
      },
      clearAppBadge: async () => {
        throw new Error('non supporte dans ce contexte');
      },
    },
    () => syncAppBadge(2)
  );
  // Laisse le microtask de rejet (catch interne) s'executer avant de finir
  // le test -- une exception non geree ferait echouer le process Node.
  await new Promise((resolve) => setImmediate(resolve));
});
