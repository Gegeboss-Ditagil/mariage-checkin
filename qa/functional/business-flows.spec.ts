import { expect, test } from '@playwright/test';
import { ROLES, db, quickLogin, watchProblems } from './helpers';

// Parcours métier de bout en bout, comme le jour J, sur la pile locale :
// vraie interface, vraie API, vraie base. Chaque test vérifie le RÉSULTAT en
// base et à l'écran, pas seulement que la page s'affiche.

const role = (key: string) => ROLES.find((r) => r.key === key)!;
const EVENT = '00000000-0000-4000-8000-000000000001';

test.describe('parcours métier', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'écritures : une seule fois (iPhone)');
  });

  test('scanneur : rechercher, ouvrir une invitation jamais ouverte, pointer puis annuler', async ({ page, request }) => {
    const problems = watchProblems(page);
    await quickLogin(page, role('agent_checkin'));
    await page.goto('/search');
    await page.getByPlaceholder('Prénom, nom, table, téléphone…').fill('Test050');
    await page.getByText('Famille Test050').first().click();
    await page.getByRole('button', { name: 'Ouvrir le check-in' }).click();
    await expect(page.getByText('Qui est arrivé ?')).toBeVisible();
    await expect(page.getByText('Personnes arrivées')).toHaveCount(0);
    const first = page.getByRole('button', { name: /^Marquer arrivé : / }).first();
    const who = (await first.getAttribute('aria-label'))!.replace('Marquer arrivé : ', '');
    await first.click();
    await expect(page.getByRole('button', { name: 'Annuler l’arrivée de ' + who })).toBeVisible();
    await expect.poll(async () => (await db<{ nombre_arrive: number }>(request, 'GET', '/invitations?select=nombre_arrive&nom_affichage=eq.Famille%20Test050'))[0].nombre_arrive).toBe(1);
    await page.getByRole('button', { name: 'Annuler l’arrivée de ' + who }).click();
    await expect.poll(async () => (await db<{ nombre_arrive: number }>(request, 'GET', '/invitations?select=nombre_arrive&nom_affichage=eq.Famille%20Test050'))[0].nombre_arrive).toBe(0);
    expect(problems).toEqual([]);
  });

  test('directeur : approuver un invité surprise -> placé, nom visible sur le dessin de sa table', async ({ page, request }) => {
    const problems = watchProblems(page);
    const name = 'QA Approuvé ' + Date.now().toString().slice(-5);
    const [req] = await db<{ id: string }>(request, 'POST', '/guest_approval_requests', {
      event_id: EVENT, token: 'qa-' + Date.now(), cote: 'Gege', nom_invite: name, nombre_invites: 1, photo_url: 'qa/a.jpg', approver_phone: '+41790000001',
    });
    await quickLogin(page, role('directeur'));
    await page.goto('/approbations');
    await page.getByRole('button', { name: 'Ouvrir la demande de ' + name }).click();
    await page.getByRole('dialog', { name }).getByRole('button', { name: 'Approuver', exact: true }).click();
    await expect.poll(async () => (await db<{ table_id: string | null }>(request, 'GET', `/guest_approval_requests?select=table_id&id=eq.${req.id}`))[0].table_id).not.toBeNull();
    const [placed] = await db<{ table_id: string }>(request, 'GET', `/guest_approval_requests?select=table_id&id=eq.${req.id}`);
    await page.goto('/tables/' + placed.table_id);
    await expect(page.getByText(name).first()).toBeVisible();
    await expect(page.getByText('Plan de la table · à jour en direct')).toBeVisible();
    // v1.74.0 : le nom est aussi sur un siège du dessin (texte SVG).
    await expect(page.locator('svg text', { hasText: 'QA' }).first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('directeur : refuser puis « Reconsidérer » -> choisir une table -> invité PLACÉ (bug v1.75.0)', async ({ page, request }) => {
    const problems = watchProblems(page);
    const name = 'QA Reconsidéré ' + Date.now().toString().slice(-5);
    const [req] = await db<{ id: string }>(request, 'POST', '/guest_approval_requests', {
      event_id: EVENT, token: 'qa-' + Date.now(), cote: 'Nelly', nom_invite: name, nombre_invites: 1, photo_url: 'qa/b.jpg', approver_phone: '+41790000002', statut: 'refuse', decided_via: 'app', decided_at: new Date().toISOString(),
    });
    await quickLogin(page, role('directeur'));
    await page.goto('/approbations');
    await page.getByRole('button', { name: 'Ouvrir la demande de ' + name }).click();
    await page.getByText('Reconsidérer').last().click();
    await page.waitForURL(/\/approbations\/.+\/assign/);
    await page.locator('button.btn-primary').last().click();
    // L'approbation puis le placement sont deux écritures successives : on
    // attend le placement (10 s max). Resté sans table = régression v1.75.0.
    await expect
      .poll(async () => (await db<{ statut: string; table_id: string | null }>(request, 'GET', `/guest_approval_requests?select=statut,table_id&id=eq.${req.id}`))[0], {
        message: 'approuvé mais SANS table : régression du bug v1.75.0',
        timeout: 10_000,
      })
      .toMatchObject({ statut: 'approuve', table_id: expect.any(String) });
    expect(problems).toEqual([]);
  });

  test('approbateur : « Tous les invités » ne mène jamais vers une page interdite', async ({ page }) => {
    const problems = watchProblems(page);
    await quickLogin(page, role('visibilite'));
    await page.goto('/dashboard/liste');
    const row = page.getByRole('button', { name: /Famille Test0/ }).first();
    await expect(row).toBeDisabled();
    await page.goto('/approbations');
    await page.getByRole('link', { name: 'Retour' }).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
    expect(problems).toEqual([]);
  });

  test('admin : la carte « Santé de la base » est entièrement verte', async ({ page }) => {
    await quickLogin(page, role('admin'));
    await page.goto('/admin');
    await expect(page.getByText(/contrôles OK/)).toBeVisible({ timeout: 15_000 });
  });

  test('admin : impossible de désactiver ou rétrograder son propre compte ; les autres demandent confirmation', async ({ page, request }) => {
    await quickLogin(page, role('admin'));
    const [me] = await db<{ id: string }>(request, 'GET', '/users?select=id&nom_affichage=eq.QA%20Admin');
    const off = await page.request.patch('/api/admin/users', { data: { id: me.id, active: false } });
    expect(off.status(), 'se désactiver soi-même doit être refusé').toBe(400);
    const demote = await page.request.patch('/api/admin/users', { data: { id: me.id, role: 'placeur', pin: '9999' } });
    expect(demote.status(), 'se rétrograder soi-même doit être refusé').toBe(400);
    expect((await db<{ active: boolean; role: string }>(request, 'GET', `/users?select=active,role&id=eq.${me.id}`))[0]).toEqual({ active: true, role: 'admin' });
    // Interface : bascule de son propre compte grisée ; celle d'un autre demande confirmation.
    await page.goto('/admin/users');
    await expect(page.getByRole('switch', { name: 'Désactiver QA Admin' })).toBeDisabled();
    let asked = '';
    page.once('dialog', (d) => { asked = d.message(); void d.dismiss(); });
    await page.getByRole('switch', { name: 'Désactiver QA Scanneur' }).click();
    await expect.poll(() => asked).toContain('Désactiver le compte');
    expect((await db<{ active: boolean }>(request, 'GET', '/users?select=active&nom_affichage=eq.QA%20Scanneur'))[0].active).toBe(true);
  });

  test('directeur : « Réinitialiser » un code demande toujours confirmation (Gestion des comptes)', async ({ page, request }) => {
    await quickLogin(page, role('directeur'));
    await page.goto('/admin/users');
    await page.getByRole('button', { name: /^Modifier / }).first().click();
    let asked = '';
    page.once('dialog', (d) => { asked = d.message(); void d.dismiss(); });
    await page.getByRole('button', { name: 'Réinitialiser' }).first().click();
    await expect.poll(() => asked).toContain('nouveau code');
    // Refusé : aucun code n'a changé.
    const rows = await db<{ pin_reset_hint: string | null }>(request, 'GET', '/users?select=pin_reset_hint&pin_reset_hint=not.is.null');
    expect(rows).toEqual([]);
  });

  test('plan : toucher une table ouvre son dessin avec les noms des invités', async ({ page }) => {
    const problems = watchProblems(page);
    await quickLogin(page, role('placeur'));
    await page.goto('/plan-table?table=7');
    await expect(page.getByText('Plan de la table · à jour en direct')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('svg text', { hasText: 'Test' }).first()).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('/scan : la bande « Prochaine activité » suit l’heure de Paris (v1.82.3)', async ({ page }) => {
    await quickLogin(page, role('directeur'));
    // 24/10/2026 16:30 à Paris (CEST = UTC+2) : l'agenda de test a 17:00, 19:00, 21:00.
    await page.clock.setFixedTime(new Date('2026-10-24T14:30:00Z'));
    await page.goto('/scan');
    await expect(page.getByText('Prochaine activité')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Accueil des invités').first()).toBeVisible();
    // 18:30 à Paris : la ligne de 17:00 est passée, la suivante est celle de 19:00.
    await page.clock.setFixedTime(new Date('2026-10-24T16:30:00Z'));
    await page.reload();
    await expect(page.getByText('Entrée des mariés').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Accueil des invités')).toHaveCount(0);
  });

  test('chaque rôle : déconnexion depuis le menu du compte', async ({ page }) => {
    for (const r of ROLES) {
      await page.context().clearCookies();
      await quickLogin(page, r);
      await page.goto(r.landing);
      page.once('dialog', (d) => void d.accept());
      await page.getByRole('button', { name: /menu du compte/i }).first().click();
      await page.getByRole('menuitem', { name: /déconnexion|se déconnecter/i }).click();
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
