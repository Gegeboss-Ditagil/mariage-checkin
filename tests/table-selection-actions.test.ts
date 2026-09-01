import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const legacyPage = readFileSync(new URL('../app/table/[tableId]/page.tsx', import.meta.url), 'utf8');
const canonicalPage = readFileSync(new URL('../app/tables/[tableId]/page.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('le dock Transferer/Echanger flotte au-dessus du bord avec un verre liquide dans les deux routes table', () => {
  for (const source of [legacyPage, canonicalPage]) {
    assert.match(source, /className="selection-action-dock"/);
    assert.match(source, /className="selection-action-button"/);
    assert.doesNotMatch(source, /fixed inset-x-0 bottom-0 border-t/);
  }
  assert.match(css, /\.selection-action-dock/);
  assert.match(css, /bottom: calc\(env\(safe-area-inset-bottom\) \+ 1rem\)/);
  assert.match(css, /backdrop-filter: blur\(24px\) saturate\(150%\)/);
  assert.match(css, /\.selection-action-button/);
});
