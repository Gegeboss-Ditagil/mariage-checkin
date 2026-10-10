import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { describeRpcFailure, rpcFailureLevel, rpcNameFromUrl } from '../lib/rpcErrorLog.ts';

// v1.75.0 : plus aucune erreur SQL avalée sans trace (point 4 de l'analyse).

test('reconnaît un appel RPC PostgREST', () => {
  assert.equal(rpcNameFromUrl('https://x.supabase.co/rest/v1/rpc/record_checkin'), 'record_checkin');
  assert.equal(rpcNameFromUrl('https://x.supabase.co/rest/v1/invitations?select=*'), null);
});

test("l'ambiguïté de fonction (cause du bug v1.75.0) est journalisée en erreur", () => {
  const failure = describeRpcFailure(
    'https://x.supabase.co/rest/v1/rpc/assign_table_to_guest_approval_strict',
    300,
    JSON.stringify({ code: 'PGRST203', message: 'Could not choose the best candidate function' })
  );
  // PostgREST répond 300 (Multiple Choices) pour PGRST203 : doit être capté.
  assert.equal(failure!.code, 'PGRST203');
  assert.equal(rpcFailureLevel(failure!), 'error');
  const real = describeRpcFailure(
    'https://x.supabase.co/rest/v1/rpc/assign_table_to_guest_approval_strict',
    400,
    JSON.stringify({ code: '42725', message: 'function assign_table_to_guest_approval_strict(...) is not unique' })
  )!;
  assert.equal(real.rpc, 'assign_table_to_guest_approval_strict');
  assert.equal(rpcFailureLevel(real), 'error');
});

test('fonction absente = erreur ; refus métier volontaire = avertissement', () => {
  const missing = describeRpcFailure('https://x/rest/v1/rpc/reset_test_event_data', 404, JSON.stringify({ code: 'PGRST202', message: 'Could not find the function' }))!;
  assert.equal(rpcFailureLevel(missing), 'error');
  const business = describeRpcFailure('https://x/rest/v1/rpc/reset_test_event_data', 400, JSON.stringify({ code: 'P0001', message: 'event_live' }))!;
  assert.equal(rpcFailureLevel(business), 'warn');
  assert.equal(describeRpcFailure('https://x/rest/v1/rpc/record_checkin', 200, '{}'), null);
  assert.equal(describeRpcFailure('https://x/rest/v1/rpc/f', 500, 'pas du json')!.message, 'pas du json');
});

test('branché une seule fois dans le client admin : couvre les 28 appels RPC serveur', () => {
  const admin = readFileSync(new URL('../lib/supabase/admin.ts', import.meta.url), 'utf8');
  assert.match(admin, /global: \{ fetch: rpcLoggingFetch\(url, serviceKey\) \}/);
  assert.match(admin, /\/rest\/v1\/app_logs/);
  assert.match(admin, /\.catch\(\(\) => \{/);
});
