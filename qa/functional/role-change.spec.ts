import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ROLES, db, quickLogin } from './helpers';

// v1.78.0, demande de Gersom : « que les admins puissent changer le rôle d'un
// user... ensuite teste que ça fonctionne directement après pour tous les
// rôles ». Un admin change le rôle d'un compte DÉJÀ CONNECTÉ dans un autre
// navigateur ; on vérifie que les droits de ce compte changent aussitôt, sans
// qu'il se reconnecte.

const role = (key: string) => ROLES.find((r) => r.key === key)!;

async function accountId(request: APIRequestContext, name: string) {
  return (await db<{ id: string }>(request, 'GET', '/users?select=id&nom_affichage=eq.' + encodeURIComponent(name)))[0].id;
}

async function me(page: Page) {
  const res = await page.request.get('/api/auth/me');
  return res.status() === 200 ? ((await res.json()) as { role: string }).role : res.status();
}

test.describe('changement de rôle par un admin', () => {
  test.beforeEach(async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'iphone', 'écritures : une seule fois (iPhone)');
    // Point de départ connu, même si un test précédent s'est arrêté en route.
    for (const r of ROLES) {
      await db(request, 'PATCH', '/users?nom_affichage=eq.' + encodeURIComponent(r.name), { role: r.key, active: true });
    }
  });

  test('chaque rôle « PIN » : effet immédiat sur la session déjà ouverte, sans ressaisir le PIN', async ({ browser, page, request }) => {
    await quickLogin(page, role('admin'));
    const target = role('placeur');
    const id = await accountId(request, target.name);
    const other = await (await browser.newContext()).newPage();
    await quickLogin(other, target);
    expect(await me(other)).toBe('placeur');

    // Ce que chaque rôle doit pouvoir (ou non) faire juste après le changement.
    const expectations: Record<string, { scan: boolean; agendaWrite: boolean }> = {
      directeur: { scan: true, agendaWrite: true },
      agent_checkin: { scan: true, agendaWrite: false },
      visibilite: { scan: false, agendaWrite: false },
      placeur: { scan: true, agendaWrite: false },
    };
    for (const [next, can] of Object.entries(expectations)) {
      const res = await page.request.patch('/api/admin/users', { data: { id, role: next } });
      expect(res.status(), `passage à ${next} sans PIN`).toBe(200);
      expect(await me(other), `rôle vu par la session ouverte après passage à ${next}`).toBe(next);
      const cookies = await other.context().cookies();
      expect(cookies.find((c) => c.name === 'wc_role')?.value, 'cookie de rôle réécrit').toBe(next);
      await other.goto('/scan');
      expect(new URL(other.url()).pathname === '/scan', `${next} : accès au scanner`).toBe(can.scan);
      const agenda = await other.request.post('/api/agenda', { data: { title: 'QA rôle ' + next, time_label: '10:00' } });
      expect(agenda.status() < 300, `${next} : écrire dans l'agenda (${agenda.status()} ${await agenda.text()})`).toBe(can.agendaWrite);
    }
    // Le PIN d'origine fonctionne toujours (jamais ressaisi).
    const relog = await other.request.post('/api/auth/login', { data: { mode: 'pin', nom_affichage: target.name, pin: target.pin } });
    expect(relog.ok(), 'PIN conservé').toBeTruthy();
  });

  test('vers admin puis retour : la session ouverte doit se reconnecter avec le nouveau mode', async ({ browser, page, request }) => {
    await quickLogin(page, role('admin'));
    const target = role('agent_checkin');
    const id = await accountId(request, target.name);
    const other = await (await browser.newContext()).newPage();
    await quickLogin(other, target);

    const up = await page.request.patch('/api/admin/users', { data: { id, role: 'admin', email: 'qa.scanneur@example.test', password: 'qa-temporaire-1' } });
    expect(up.status()).toBe(200);
    expect(await me(other), 'mode de connexion changé : session fermée').toBe(401);
    const asAdmin = await other.request.post('/api/auth/login', { data: { mode: 'password', email: 'qa.scanneur@example.test', password: 'qa-temporaire-1' } });
    expect(asAdmin.ok(), 'connexion admin avec le nouvel identifiant').toBeTruthy();
    expect(await me(other)).toBe('admin');

    const down = await page.request.patch('/api/admin/users', { data: { id, role: 'agent_checkin', pin: target.pin } });
    expect(down.status()).toBe(200);
    expect(await me(other)).toBe(401);
    const back = await other.request.post('/api/auth/login', { data: { mode: 'pin', nom_affichage: target.name, pin: target.pin } });
    expect(back.ok()).toBeTruthy();
    expect(await me(other)).toBe('agent_checkin');
  });

  test('compte désactivé : déconnecté immédiatement, réactivé : peut revenir', async ({ browser, page, request }) => {
    await quickLogin(page, role('admin'));
    const target = role('visibilite');
    const id = await accountId(request, target.name);
    const other = await (await browser.newContext()).newPage();
    await quickLogin(other, target);
    expect(await me(other)).toBe('visibilite');
    expect((await page.request.patch('/api/admin/users', { data: { id, active: false } })).status()).toBe(200);
    expect(await me(other)).toBe(401);
    expect((await page.request.patch('/api/admin/users', { data: { id, active: true } })).status()).toBe(200);
    const back = await other.request.post('/api/auth/login', { data: { mode: 'pin', nom_affichage: target.name, pin: target.pin } });
    expect(back.ok()).toBeTruthy();
  });

  test('dans l’écran : changer le rôle d’un scanneur en directeur, sans PIN, et sa barre change toute seule', async ({ browser, page, request }) => {
    test.setTimeout(90_000);
    await quickLogin(page, role('admin'));
    const target = role('agent_checkin');
    const other = await (await browser.newContext()).newPage();
    await quickLogin(other, target);
    await other.goto('/dashboard');
    await expect(other.getByRole('link', { name: 'Agenda' })).toBeVisible();

    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Modifier ' + target.name }).click();
    await page.getByRole('combobox').last().selectOption('directeur');
    await expect(page.getByText(/Son PIN actuel reste valable/)).toBeVisible();
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect.poll(async () => (await db<{ role: string }>(request, 'GET', '/users?select=role&nom_affichage=eq.' + encodeURIComponent(target.name)))[0].role).toBe('directeur');

    // Sans rien toucher, la page du scanneur se met à jour (vérification
    // toutes les 20 s) : le cookie de rôle devient « directeur ».
    await expect.poll(async () => (await other.context().cookies()).find((c) => c.name === 'wc_role')?.value, { timeout: 30_000 }).toBe('directeur');

    // Remise en état.
    const id = await accountId(request, target.name);
    expect((await page.request.patch('/api/admin/users', { data: { id, role: 'agent_checkin' } })).status()).toBe(200);
  });
});
