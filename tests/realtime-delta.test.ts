import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRowDelta } from '../lib/realtimeDelta.ts';

type Row = { id: string; v: number };

test('INSERT ajoute la ligne et ne la duplique jamais (upsert idempotent)', () => {
  const base: Row[] = [{ id: 'a', v: 1 }];
  const inserted = applyRowDelta(base, { eventType: 'INSERT', new: { id: 'b', v: 2 }, old: null });
  assert.equal(inserted.length, 2);
  assert.equal(inserted[1].v, 2);
  // Meme id deja present : remplacement, pas de doublon.
  const reinserted = applyRowDelta(inserted, { eventType: 'INSERT', new: { id: 'b', v: 9 }, old: null });
  assert.equal(reinserted.length, 2);
  assert.equal(reinserted.find((r) => r.id === 'b')?.v, 9);
});

test('UPDATE remplace la ligne cible et retourne un NOUVEAU tableau', () => {
  const base: Row[] = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
  const updated = applyRowDelta(base, { eventType: 'UPDATE', new: { id: 'a', v: 42 }, old: null });
  assert.notEqual(updated, base, 'un nouveau tableau est requis pour le re-rendu React');
  assert.equal(updated.length, 2);
  assert.equal(updated.find((r) => r.id === 'a')?.v, 42);
  assert.equal(updated.find((r) => r.id === 'b')?.v, 2);
  // Pas d'ecriture fantome sur une ligne inconnue.
  const noop = applyRowDelta(base, { eventType: 'UPDATE', new: { id: 'zzz', v: 3 }, old: null });
  assert.equal(noop.length, 2);
});

test('DELETE retire la ligne via payload.old, sans erreur si id inconnu', () => {
  const base: Row[] = [{ id: 'a', v: 1 }, { id: 'b', v: 2 }];
  const deleted = applyRowDelta(base, { eventType: 'DELETE', new: null, old: { id: 'a', v: 1 } });
  assert.equal(deleted.length, 1);
  assert.equal(deleted[0].id, 'b');
  const missing = applyRowDelta(base, { eventType: 'DELETE', new: null, old: { id: 'zzz', v: 0 } });
  assert.equal(missing.length, 2);
});

test('un payload inconnu ou vide laisse la liste intacte', () => {
  const base: Row[] = [{ id: 'a', v: 1 }];
  assert.equal(applyRowDelta(base, { eventType: 'UPDATE', new: null, old: null }).length, 1);
  assert.equal(applyRowDelta(base, { eventType: 'DELETE', new: null, old: null }).length, 1);
});