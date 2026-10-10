import { expect, test } from '@playwright/test';
import { ROLES, db, quickLogin } from './helpers';

// v1.79.0, signalé par Gersom : « Sergio et Test, mis en table 1 pendant le
// mode test, sont encore là après le bouton rouge ». Le bouton rouge doit
// effacer TOUT ce que les agents font pendant les essais, sans toucher aux
// invités importés ; il reste bloqué en mode JOUR J.

const role = (key: string) => ROLES.find((r) => r.key === key)!;
const EVENT = '00000000-0000-4000-8000-000000000001';

test.describe('mode test puis réinitialisation', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'écritures : une seule fois (iPhone)');
  });

  test('le bouton rouge efface invités surprise, arrivées et demandes ; les invités importés restent', async ({ page, request }) => {
    await db(request, 'PATCH', `/events?id=eq.${EVENT}`, { status: 'test' });
    const importedBefore = await db<{ id: string }>(request, 'GET', '/invitations?select=id&notes=not.like.Invit%C3%A9%20surprise%20approuv%C3%A9*');
    const tablesBefore = await db<{ id: string; table_id: string }>(request, 'GET', '/invitations?select=id,table_id&order=id');

    // Pendant les essais : un invité surprise approuvé et placé…
    const name = 'QA Essai ' + Date.now().toString().slice(-5);
    const [req] = await db<{ id: string }>(request, 'POST', '/guest_approval_requests', {
      event_id: EVENT, token: 'qa-' + Date.now(), cote: 'Gege', nom_invite: name, nombre_invites: 1, photo_url: 'qa/r.jpg', approver_phone: '+41790000009',
    });
    await quickLogin(page, role('directeur'));
    expect((await page.request.post(`/api/guest-approvals/${req.id}/decide`, { data: { decision: 'approuve' } })).ok()).toBeTruthy();
    await expect.poll(async () => (await db(request, 'GET', '/invitations?select=id&nom_affichage=eq.' + encodeURIComponent(name))).length).toBe(1);
    // … et une arrivée pointée sur une invitation importée.
    const [inv] = await db<{ id: string }>(request, 'GET', '/invitations?select=id&nom_affichage=eq.Famille%20Test006');
    await page.goto('/checkin/' + inv.id);
    await page.getByRole('button', { name: /^Marquer arrivé : / }).first().click();
    await expect.poll(async () => (await db<{ nombre_arrive: number }>(request, 'GET', `/invitations?select=nombre_arrive&id=eq.${inv.id}`))[0].nombre_arrive).toBe(1);

    // Bouton rouge, en mode test.
    await page.context().clearCookies();
    await quickLogin(page, role('admin'));
    await page.goto('/admin');
    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'RÉINITIALISER LES DONNÉES DE TEST' }).click();
    await expect(page.getByText(/Données de test effacées/)).toBeVisible();

    expect(await db(request, 'GET', '/invitations?select=id&nom_affichage=eq.' + encodeURIComponent(name)), 'invité surprise effacé').toEqual([]);
    expect(await db(request, 'GET', '/guest_approval_requests?select=id'), 'demandes effacées').toEqual([]);
    expect(await db(request, 'GET', '/checkins?select=id'), 'scans effacés').toEqual([]);
    expect(await db(request, 'GET', '/invitations?select=id&nombre_arrive=gt.0'), 'arrivées remises à zéro').toEqual([]);
    expect(await db(request, 'GET', '/guests?select=id&arrival_status=eq.arrive'), 'personnes remises à « attendu »').toEqual([]);
    const importedAfter = await db<{ id: string }>(request, 'GET', '/invitations?select=id&notes=not.like.Invit%C3%A9%20surprise%20approuv%C3%A9*');
    expect(importedAfter.length, 'aucun invité importé supprimé').toBe(importedBefore.length);
    const tablesAfter = await db<{ id: string; table_id: string }>(request, 'GET', '/invitations?select=id,table_id&order=id');
    expect(tablesAfter.filter((t) => importedBefore.some((i) => i.id === t.id)), 'tables des invités importés inchangées')
      .toEqual(tablesBefore.filter((t) => importedBefore.some((i) => i.id === t.id)));
  });

  test('en mode JOUR J, le bouton rouge est bloqué et l’écran dit quoi faire', async ({ page, request }) => {
    await db(request, 'PATCH', `/events?id=eq.${EVENT}`, { status: 'live' });
    try {
      await quickLogin(page, role('admin'));
      await page.goto('/admin');
      await expect(page.getByRole('button', { name: 'RÉINITIALISER LES DONNÉES DE TEST' })).toBeDisabled();
      await expect(page.getByText(/Bloqué en mode JOUR J/)).toBeVisible();
      // Même en appelant l'API directement : refusé, avec un message en clair.
      const res = await page.request.post('/api/admin/reset-test-data');
      expect(res.status()).toBe(409);
    } finally {
      await db(request, 'PATCH', `/events?id=eq.${EVENT}`, { status: 'test' });
    }
  });
});
