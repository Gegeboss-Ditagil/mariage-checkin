import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

test('/plan-table rappelle le mode de tri actif juste au-dessus de la liste des tables', () => {
  const source = readFileSync(new URL('../app/plan-table/page.tsx', import.meta.url), 'utf8');
  assert.match(source, /triées par places libres/);
  assert.match(source, /triées par numéro, 1 → 40/);
  assert.match(source, /tri === 'libres' \? 'triées par places libres/);
});
