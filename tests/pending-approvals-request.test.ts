import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchPendingApprovalsCount } from '../lib/pendingApprovalsRequest.ts';

// v1.58.0, trouve en creusant un signalement de "freeze au tap" : trois
// composants (AccountMenu, BottomNav, GuestApprovalsShortcut) sondaient
// chacun /api/guest-approvals?count=pending independamment, produisant des
// bursts de 2-3 requetes identiques simultanees (confirme dans les logs
// Vercel). Test comportemental (pas seulement une inspection du source) :
// deux appels concurrents doivent partager la MEME requete reseau.

test('fetchPendingApprovalsCount partage la meme requete en vol entre des appels concurrents', async () => {
  let fetchCount = 0;
  const original = globalThis.fetch;
  (globalThis as any).fetch = async () => {
    fetchCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Response(JSON.stringify({ pending_count: 3, latest: null }), { status: 200 });
  };
  try {
    const [a, b, c] = await Promise.all([
      fetchPendingApprovalsCount(),
      fetchPendingApprovalsCount(),
      fetchPendingApprovalsCount(),
    ]);
    assert.equal(fetchCount, 1, 'trois appels concurrents ne doivent declencher qu\'une seule requete reseau');
    assert.deepEqual(a, { pending_count: 3, latest: null });
    assert.deepEqual(b, { pending_count: 3, latest: null });
    assert.deepEqual(c, { pending_count: 3, latest: null });
  } finally {
    globalThis.fetch = original;
  }
});

test('fetchPendingApprovalsCount refait une vraie requete une fois la precedente terminee', async () => {
  let fetchCount = 0;
  const original = globalThis.fetch;
  (globalThis as any).fetch = async () => {
    fetchCount += 1;
    return new Response(JSON.stringify({ pending_count: fetchCount, latest: null }), { status: 200 });
  };
  try {
    const first = await fetchPendingApprovalsCount();
    const second = await fetchPendingApprovalsCount();
    assert.equal(fetchCount, 2, 'deux appels sequentiels (jamais concurrents) doivent chacun declencher leur propre requete');
    assert.deepEqual(first, { pending_count: 1, latest: null });
    assert.deepEqual(second, { pending_count: 2, latest: null });
  } finally {
    globalThis.fetch = original;
  }
});

test('fetchPendingApprovalsCount renvoie null sans jeter si le reseau ou le serveur echoue', async () => {
  const original = globalThis.fetch;
  (globalThis as any).fetch = async () => {
    throw new Error('network down');
  };
  try {
    const result = await fetchPendingApprovalsCount();
    assert.equal(result, null);
  } finally {
    globalThis.fetch = original;
  }
});

test('fetchPendingApprovalsCount renvoie null pour une reponse HTTP non-ok (401, 500...)', async () => {
  const original = globalThis.fetch;
  (globalThis as any).fetch = async () => new Response('{}', { status: 401 });
  try {
    const result = await fetchPendingApprovalsCount();
    assert.equal(result, null);
  } finally {
    globalThis.fetch = original;
  }
});
