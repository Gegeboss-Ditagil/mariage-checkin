import { expect, test, type Page } from '@playwright/test';

// v1.75.0 -- « première utilisation » pour chaque rôle, comme un nouvel agent
// le jour J : appareil vierge (aucun cookie, aucun stockage), connexion,
// choix du thème, page d'arrivée, chaque onglet de la barre du bas, puis
// première ouverture d'une invitation jamais ouverte.
//
// Variables (une par rôle, rôle ignoré si absente) :
//   E2E_BASE_URL                       ex. https://<aperçu>.vercel.app
//   E2E_<ROLE>_NAME / E2E_<ROLE>_PIN   ROLE = ADMIN, DIRECTEUR, PLACEUR, AGENT_CHECKIN, VISIBILITE
//   E2E_FRESH_INVITATION_ID            invitation de test SANS lignes nominatives
//                                      (scripts/sql-tests/02_e2e_fresh_invitation.sql la remet à zéro)
// Écritures : uniquement la création des lignes nominatives de l'invitation de
// test (aucune arrivée n'est cochée).

const ROLES = [
  { key: 'ADMIN', landing: '/scan', tabs: ['/search', '/plan-table', '/dashboard', '/scan'], checkin: true },
  { key: 'DIRECTEUR', landing: '/dashboard', tabs: ['/search', '/plan-table', '/agenda', '/approbations', '/scan'], checkin: true },
  { key: 'PLACEUR', landing: '/scan', tabs: ['/search', '/plan-table', '/agenda', '/dashboard'], checkin: true },
  { key: 'AGENT_CHECKIN', landing: '/scan', tabs: ['/search', '/plan-table', '/agenda', '/dashboard'], checkin: true },
  { key: 'VISIBILITE', landing: '/dashboard', tabs: ['/dashboard', '/plan-table', '/search', '/approbations'], checkin: false },
] as const;

async function login(page: Page, name: string, pin: string) {
  await page.goto('/login');
  await page.getByPlaceholder('Ex: Dos').fill(name);
  await page.getByPlaceholder('****').fill(pin);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  // Premier appareil : écran de choix du thème, une seule fois.
  await page.waitForURL(/\/onboarding\/theme/, { timeout: 15_000 });
  await page.getByRole('button', { name: /^Continuer/ }).click();
}

for (const role of ROLES) {
  const name = process.env[`E2E_${role.key}_NAME`];
  const pin = process.env[`E2E_${role.key}_PIN`];

  test.describe(`première utilisation -- ${role.key}`, () => {
    test.skip(!process.env.E2E_BASE_URL || !name || !pin, `E2E_BASE_URL / E2E_${role.key}_NAME / _PIN absents`);

    test('connexion, thème, page d’arrivée, onglets, aucune erreur', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));

      await login(page, name!, pin!);
      await page.waitForURL((url) => url.pathname.startsWith(role.landing), { timeout: 15_000 });

      for (const href of role.tabs) {
        await page.goto(href);
        await page.waitForLoadState('networkidle');
        // Jamais renvoyé ailleurs (page interdite) ni vers /login.
        expect(new URL(page.url()).pathname, `${role.key} -> ${href}`).toMatch(new RegExp('^' + href));
        await expect(page.getByText('Accès réservé')).toHaveCount(0);
      }
      expect(errors, 'erreurs JavaScript').toEqual([]);
    });

    test('première ouverture d’une invitation jamais ouverte', async ({ page }) => {
      const invitationId = process.env.E2E_FRESH_INVITATION_ID;
      test.skip(!invitationId || !role.checkin, 'pas d’invitation de test, ou rôle sans check-in');
      await login(page, name!, pin!);
      await page.goto('/checkin/' + invitationId);
      // v1.73.1 : jamais l'ancien compteur +/- « Personnes arrivées ».
      await expect(page.getByText('Qui est arrivé ?')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Personnes arrivées')).toHaveCount(0);
    });
  });
}
