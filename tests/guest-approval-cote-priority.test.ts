import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Retour de Gersom le 16/09/2026 (capture d'écran d'une demande "Test" placée
// automatiquement) : "si la personne est venue avec quelqu'un... on va
// suggérer en premier : un, on va analyser sa table, et deux, si elle est
// côté GG ou côté Nelly pour la mettre dans une table qui est pareille, et
// sinon ensuite l'excédentaire. Et ensuite, s'il y a plein de places dans
// l'excédentaire, voir s'il y a d'autres places quelque part d'autre."
//
// auto_assign_table_for_guest_approval (0045/0046) essayait la table
// excédentaire (réserve) AVANT le côté -- 0056 inverse cet ordre : le côté
// passe désormais devant la réserve. Seul l'ordre change, chaque étape
// individuelle (calcul de "libres", de "même côté") reste identique à 0046.

const cotePriorityMigration = readFileSync(
  new URL('../supabase/migrations/0056_guest_approval_cote_before_reserve.sql', import.meta.url),
  'utf8'
);
const assignPageSource = readFileSync(new URL('../app/approbations/[id]/assign/page.tsx', import.meta.url), 'utf8');

test('0056 : auto_assign_table_for_guest_approval essaie le côté (priorité 1) avant la table excédentaire (priorité 2)', () => {
  assert.match(cotePriorityMigration, /create or replace function auto_assign_table_for_guest_approval/);
  const idxLinked = cotePriorityMigration.indexOf('Priorite 0');
  const idxCote = cotePriorityMigration.indexOf('Priorite 1');
  const idxReserve = cotePriorityMigration.indexOf('Priorite 2');
  const idxAutre = cotePriorityMigration.indexOf('Priorite 3');
  assert.ok(
    idxLinked > 0 && idxCote > idxLinked && idxReserve > idxCote && idxAutre > idxReserve,
    'ordre attendu : groupe lié, puis côté, puis réserve, puis toute autre table'
  );
  // La priorité 1 (côté) exclut explicitement les tables de réserve et exige
  // candidates.meme_cote -- jamais appliquée à la table excédentaire.
  assert.match(cotePriorityMigration, /where t\.event_id = v_req\.event_id and not t\.is_reserve\s*\n\s*\) candidates\s*\n\s*where candidates\.libres >= v_req\.nombre_invites and candidates\.meme_cote/);
  assert.match(cotePriorityMigration, /security invoker set search_path = public, pg_temp/);
});

test('0056 : la priorité 3 (n\'importe quelle autre table) reste possible même côté opposé, uniquement après avoir essayé la réserve', () => {
  const prio3 = cotePriorityMigration.slice(cotePriorityMigration.indexOf('Priorite 3'));
  assert.match(prio3, /where t\.event_id = v_req\.event_id and not t\.is_reserve/);
  assert.doesNotMatch(prio3, /meme_cote/);
});

test("lib/guestApprovalDecide.ts continue d'appeler le même RPC auto_assign_table_for_guest_approval (seul son corps change, jamais son nom/signature)", () => {
  const decideSource = readFileSync(new URL('../lib/guestApprovalDecide.ts', import.meta.url), 'utf8');
  assert.match(decideSource, /supabase\.rpc\('auto_assign_table_for_guest_approval', \{/);
});

test("app/approbations/[id]/assign/page.tsx : la sélection manuelle de table applique la même priorité (groupe lié, puis même côté, puis réserve, puis autre)", () => {
  assert.match(assignPageSource, /const sameCoteTableIds = useMemo\(/);
  assert.match(assignPageSource, /if \(linkedTableId && usage\.table\.id === linkedTableId\) return 0;/);
  assert.match(assignPageSource, /if \(!usage\.table\.is_reserve && sameCoteTableIds\.has\(usage\.table\.id\)\) return 1;/);
  assert.match(assignPageSource, /return usage\.table\.is_reserve \? 2 : 3;/);
  // Badge visuel expliquant pourquoi une table est recommandée par côté,
  // distinct du badge "arrivé avec ce groupe" déjà existant.
  assert.match(assignPageSource, /★ Même côté/);
});
