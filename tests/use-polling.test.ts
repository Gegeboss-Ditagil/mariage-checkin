import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Convention du dossier : les composants JSX sont inspectes via readFileSync
// plutot qu'importes (le type stripping natif de Node ne transforme pas JSX).
const pollingHook = readFileSync(new URL('../hooks/usePolling.ts', import.meta.url), 'utf8');

const POLLING_USERS = [
  '../components/AccountMenu.tsx',
  '../components/BottomNav.tsx',
  '../components/GuestApprovalsShortcut.tsx',
  '../components/NextAgendaActivity.tsx',
  '../app/staff/page.tsx',
  '../app/agenda/page.tsx',
  '../app/approbations/page.tsx',
];

test('usePolling met l intervalle en pause quand l onglet quitte le premier plan', () => {
  assert.match(pollingHook, /visibilityState === 'visible'/);
  assert.match(pollingHook, /setInterval/);
  assert.match(pollingHook, /clearInterval/);
});

test('tous les sondages production passent par usePolling (plus de setInterval en dur)', () => {
  for (const rel of POLLING_USERS) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
    assert.ok(src.includes("from '@/hooks/usePolling'"), rel + ' doit importer usePolling');
    assert.match(src, /usePolling\(/, rel + ' doit utiliser usePolling pour son sondage');
    assert.doesNotMatch(src, /setInterval\(/, rel + ' ne doit plus creer d intervalle en dur');
  }
});