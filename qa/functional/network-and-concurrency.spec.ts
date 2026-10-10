import { expect, test } from '@playwright/test';
import { ROLES, db, quickLogin, watchProblems } from './helpers';

// Ce que ni le code ni la QA ne testaient : connexion faible ou coupée dans
// la salle, et plusieurs agents qui touchent la même invitation en même temps.

const role = (key: string) => ROLES.find((r) => r.key === key)!;

async function invitationId(request: import('@playwright/test').APIRequestContext, name: string) {
  return (await db<{ id: string }>(request, 'GET', '/invitations?select=id&nom_affichage=eq.' + encodeURIComponent(name)))[0].id;
}

test.describe('réseau et simultanéité', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== 'android', 'une fois, sur Android (réseau mobile)');
  });

  test('3G lente : les écrans du jour J restent utilisables (< 8 s) et sans erreur', async ({ page }) => {
    const problems = watchProblems(page);
    await quickLogin(page, role('agent_checkin'));
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 400, downloadThroughput: (400 * 1024) / 8, uploadThroughput: (400 * 1024) / 8 });
    for (const path of ['/scan', '/search', '/dashboard', '/plan-table']) {
      const started = Date.now();
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.getByRole('navigation').first().waitFor({ timeout: 15_000 }).catch(() => {});
      const ms = Date.now() - started;
      expect(ms, `${path} en 3G lente`).toBeLessThan(8000);
    }
    expect(problems).toEqual([]);
  });

  test('coupure réseau : la fiche le signale et bloque le pointage, puis tout repart au retour du réseau', async ({ page, request }) => {
    const problems = watchProblems(page);
    const id = await invitationId(request, 'Famille Test060');
    await quickLogin(page, role('placeur'));
    await page.goto('/checkin/' + id);
    await expect(page.getByText('Qui est arrivé ?')).toBeVisible({ timeout: 15_000 });
    await page.context().setOffline(true);
    await page.getByRole('button', { name: /^Marquer arrivé : / }).first().click();
    await expect(page.getByText(/CONNEXION REQUISE|hors ligne|HORS LIGNE/i).first()).toBeVisible();
    expect((await db<{ nombre_arrive: number }>(request, 'GET', `/invitations?select=nombre_arrive&id=eq.${id}`))[0].nombre_arrive).toBe(0);
    await page.context().setOffline(false);
    await page.reload();
    await expect(page.getByText('Qui est arrivé ?')).toBeVisible({ timeout: 15_000 });
    expect(problems.filter((p) => !/Failed to fetch|NetworkError|ERR_INTERNET_DISCONNECTED/.test(p))).toEqual([]);
  });

  test('deux agents pointent la même famille en même temps : compteur exact, aucune personne comptée deux fois', async ({ browser, request }) => {
    const id = await invitationId(request, 'Famille Test070');
    const agents = await Promise.all([role('agent_checkin'), role('placeur')].map(async (r) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      await quickLogin(page, r);
      await page.goto('/checkin/' + id);
      await expect(page.getByText('Qui est arrivé ?')).toBeVisible({ timeout: 15_000 });
      return page;
    }));
    // Les deux agents touchent la même première personne au même moment.
    await Promise.all(agents.map((p) => p.getByRole('button', { name: /^Marquer arrivé : / }).first().click()));
    await expect.poll(async () => (await db<{ nombre_arrive: number }>(request, 'GET', `/invitations?select=nombre_arrive&id=eq.${id}`))[0].nombre_arrive).toBeLessThanOrEqual(1);
    const guests = await db<{ guests: { arrival_status: string } }>(request, 'GET', `/invitation_guests?select=guests(arrival_status)&invitation_id=eq.${id}`);
    const arrived = guests.filter((g) => g.guests.arrival_status === 'arrive').length;
    const [inv] = await db<{ nombre_arrive: number }>(request, 'GET', `/invitations?select=nombre_arrive&id=eq.${id}`);
    expect(inv.nombre_arrive, 'compteur = personnes cochées').toBe(arrived);
  });
});
