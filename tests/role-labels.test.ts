import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ROLE_LABELS } from '../lib/types.ts';

// Demande de Gersom le 17/09/2026 (capture d'écran /scan, eyebrow "STAFF"
// générique au-dessus de "Scanner un QR code") : "pas juste écrire staff...
// le bon rôle" pour chaque personne connectée.

test('ROLE_LABELS donne un nom precis par role, jamais un "Staff" generique', () => {
  assert.equal(ROLE_LABELS.admin, 'Admin');
  assert.equal(ROLE_LABELS.directeur, 'Directeur de festin');
  assert.equal(ROLE_LABELS.placeur, 'Agent placeur');
  assert.equal(ROLE_LABELS.agent_checkin, 'Agent scanner');
  // "visibilite" a en realite reviewGuestApproval/assignGuestApproval
  // depuis v1.42.0 (lib/permissions.ts) -- "Visibilité (lecture seule)"
  // etait devenu inexact. "Approbateur" reflete son usage reel.
  assert.equal(ROLE_LABELS.visibilite, 'Approbateur');
});

test('/scan affiche le vrai role connecte au lieu du texte fixe "Staff"', () => {
  const scanPageSource = readFileSync(new URL('../app/scan/page.tsx', import.meta.url), 'utf8');
  assert.match(scanPageSource, /import \{ ROLE_LABELS \} from '@\/lib\/types';/);
  assert.match(scanPageSource, /\{role \? ROLE_LABELS\[role\] : 'Staff'\}/);
});
