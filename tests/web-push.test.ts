import assert from 'node:assert/strict';
import test from 'node:test';
import webpush from 'web-push';
import { deliverPush, notifyGuestApprovalReviewers, notifyGuestApprovalPlaceurs } from '../lib/webPush.ts';

// v1.83.0 : tests de comportement (pas de lecture du code source) -- faux
// client Supabase + faux émetteur Push, aucune requête réseau.
type Row = Record<string, unknown>;
function fakeSupabase(tables: Record<string, Row[]>, deleted: string[] = []) {
  const builder = (name: string) => {
    let rows = tables[name] ?? [];
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (col: string, value: unknown) => { rows = rows.filter((r) => r[col] === value); return api; },
      in: (col: string, values: unknown[]) => { rows = rows.filter((r) => values.includes(r[col])); return api; },
      delete: () => ({ eq: (_c: string, id: string) => { deleted.push(id); return Promise.resolve({}); } }),
      then: (resolve: (v: unknown) => void) => resolve({ data: rows, count: rows.length }),
    };
    return api;
  };
  return { from: builder } as never;
}

const subs = [
  { id: 's1', event_id: 'e', user_id: 'dir', endpoint: 'https://push/1', p256dh: 'k', auth: 'a' },
  { id: 's2', event_id: 'e', user_id: 'plc', endpoint: 'https://push/2', p256dh: 'k', auth: 'a' },
  { id: 's3', event_id: 'e', user_id: 'off', endpoint: 'https://push/3', p256dh: 'k', auth: 'a' },
];
const users = [
  { id: 'dir', role: 'directeur', active: true },
  { id: 'plc', role: 'placeur', active: true },
  { id: 'off', role: 'directeur', active: false },
];
const request = { id: 'r1', event_id: 'e', nom_invite: 'Test', cote: 'Gege', nombre_invites: 2 };

test('les approbateurs actifs reçoivent le Push, pas les placeurs ni les comptes désactivés', async () => {
  const keys = webpush.generateVAPIDKeys(); // paire jetable, jamais une vraie clé
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  const sentTo: string[] = [];
  const supabase = fakeSupabase({ push_subscriptions: subs, users, guest_approval_requests: [{ event_id: 'e', statut: 'en_attente' }] });
  await notifyGuestApprovalReviewers(supabase, request, async (sub, body) => { sentTo.push(sub.endpoint); assert.equal(JSON.parse(body).badgeCount, 1); });
  assert.deepEqual(sentTo, ['https://push/1']);
});

test('les placeurs actifs reçoivent le Push de table', async () => {
  const sentTo: string[] = [];
  const supabase = fakeSupabase({ push_subscriptions: subs, users });
  await notifyGuestApprovalPlaceurs(supabase, request, 12, async (sub, body) => { sentTo.push(sub.endpoint); assert.match(JSON.parse(body).body, /Table 12/); });
  assert.deepEqual(sentTo, ['https://push/2']);
});

test('un abonnement expiré (410) est supprimé, un autre échec ne bloque pas les envois suivants', async () => {
  const deleted: string[] = [];
  const supabase = fakeSupabase({}, deleted);
  const sent = await deliverPush(supabase, 'e', subs, '{}', async (sub) => {
    if (sub.endpoint.endsWith('/1')) throw Object.assign(new Error('gone'), { statusCode: 410 });
    if (sub.endpoint.endsWith('/2')) throw Object.assign(new Error('boom'), { statusCode: 500 });
  });
  assert.equal(sent, 1);
  assert.deepEqual(deleted, ['s1']);
});

test('sans clés VAPID : aucun envoi et aucune exception', async () => {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
  let called = false;
  await notifyGuestApprovalReviewers(fakeSupabase({ push_subscriptions: subs, users }), request, async () => { called = true; });
  assert.equal(called, false);
});
