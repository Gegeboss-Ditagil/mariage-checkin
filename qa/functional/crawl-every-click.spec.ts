import { expect, test } from '@playwright/test';
import { ROLES, attachReport, cls, installClsProbe, quickLogin, watchProblems } from './helpers';

// « Clique partout » : pour chaque rôle, chaque page qu'il peut ouvrir, chaque
// bouton/lien visible est cliqué. Échoue sur : erreur JavaScript, erreur
// serveur (5xx), appel API refusé (401/403 = bouton montré à un rôle qui n'a
// pas le droit), déconnexion inattendue, « Accès réservé », page trop lente
// (> 3 s) ou qui saute à l'affichage (CLS > 0,25). Les confirmations
// (window.confirm) sont refusées : aucune suppression réelle.

const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DB = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';

async function ids(request: import('@playwright/test').APIRequestContext) {
  const get = async (path: string) => {
    const res = await request.get(DB + path, { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } });
    return (await res.json()) as { id: string }[];
  };
  const [inv] = await get('/invitations?select=id&nom_affichage=eq.Famille%20Test020');
  const [table] = await get('/tables?select=id&number=eq.7');
  const [req] = await get('/guest_approval_requests?select=id&limit=1');
  return { invitation: inv.id, table: table.id, request: req?.id };
}

const SKIP_LABELS = /déconnexion|se déconnecter|caméra|photo|installer|activer les notifications|📷/i;

test.describe('clique partout, chaque rôle', () => {

  for (const role of ROLES) {
    test(`${role.key} : toutes les pages, tous les boutons`, async ({ page, request }, testInfo) => {
      test.skip(testInfo.project.name !== 'iphone' && testInfo.project.name !== 'ordinateur', 'balayage complet sur iPhone et ordinateur');
      test.setTimeout(900_000);
      const { invitation, table, request: requestId } = await ids(request);
      const pages = [
        '/scan', '/dashboard', '/dashboard/liste', '/search', '/plan-table', '/agenda', '/approbations', '/staff',
        '/exceptions', '/history', '/mon-mot-de-passe', '/mots-de-passe', '/admin', '/admin/users', '/admin/logs',
        '/admin/tables', '/admin/exports', '/admin/import-withjoy', '/admin/wizard', '/tables', '/placement',
        `/tables/${table}`, `/checkin/${invitation}`, ...(requestId ? [`/approbations/${requestId}/assign`] : []),
      ];
      // Confirmations refusées : rien d'irréversible n'est exécuté. On note
      // qu'une confirmation a été demandée, pour repérer les écritures faites
      // d'un seul toucher SANS confirmation (v1.76.0 : désactiver son propre
      // compte, réinitialiser un code, changer le mode de l'événement).
      let dialogShown = false;
      const writes: string[] = [];
      page.on('dialog', (d) => { dialogShown = true; void d.dismiss(); });
      page.on('request', (r) => {
        const url = new URL(r.url());
        if (r.method() !== 'GET' && url.pathname.startsWith('/api/') && !url.pathname.startsWith('/api/public/')) writes.push(`${r.method()} ${url.pathname}`);
      });
      const oneTapWrites: string[] = [];
      await installClsProbe(page);
      await quickLogin(page, role);
      const problems = watchProblems(page);
      const report: string[] = [];

      for (const path of pages) {
        const started = Date.now();
        await page.goto(path);
        await page.waitForLoadState('networkidle').catch(() => {});
        const landed = new URL(page.url()).pathname;
        if (landed === '/login') problems.push(`${path} : déconnecté`);
        if (landed !== path.split('?')[0]) {
          report.push(`${path} : non autorisé pour ce rôle (renvoyé vers ${landed})`);
          continue;
        }
        const loadMs = Date.now() - started;
        // Ouverte par son adresse, une page réservée à d'autres rôles affiche
        // « Accès réservé » : comportement voulu, pas un bug -- seul un CLIC
        // qui y mène en est un (vérifié plus bas).
        if (await page.getByText('Accès réservé').count()) {
          report.push(`${path} : « Accès réservé » (adresse directe, attendu)`);
          continue;
        }
        if (loadMs > 3000) problems.push(`${path} : chargement lent (${loadMs} ms)`);
        const shift = await cls(page);
        if (shift > 0.25) problems.push(`${path} : la page saute à l'affichage (CLS ${shift.toFixed(2)})`);
        report.push(`${path} : ${loadMs} ms, CLS ${shift.toFixed(3)}`);

        const clickables = page.locator('main a[href], main button, a[href]:visible, button:visible, [role="button"]:visible, input[type="checkbox"]:visible');
        const total = Math.min(await clickables.count(), 40);
        for (let i = 0; i < total; i += 1) {
          // Page rechargée avant CHAQUE clic : une fiche ouverte par le clic
          // précédent ne doit pas masquer les boutons suivants.
          if (i > 0) {
            await page.goto(path);
            await page.waitForLoadState('networkidle').catch(() => {});
          }
          const target = clickables.nth(i);
          if (!(await target.isVisible().catch(() => false)) || (await target.isDisabled().catch(() => true))) continue;
          const label = ((await target.getAttribute('aria-label')) || (await target.innerText().catch(() => '')) || (await target.getAttribute('href')) || '?').trim().slice(0, 60);
          if (SKIP_LABELS.test(label)) continue;
          const before = problems.length;
          dialogShown = false;
          writes.length = 0;
          await target.click({ timeout: 3000 }).catch((e) => problems.push(`${path} : clic impossible sur « ${label} » (${String(e).split('\n')[0].slice(0, 80)})`));
          await page.waitForTimeout(400);
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          const after = new URL(page.url()).pathname;
          if (after === '/login') problems.push(`${path} : « ${label} » a déconnecté l'utilisateur`);
          if (await page.getByText('Accès réservé').count()) problems.push(`${path} : « ${label} » mène à « Accès réservé »`);
          if (problems.length > before) problems[problems.length - 1] += ` [après « ${label} » sur ${path}]`;
          if (writes.length && !dialogShown) oneTapWrites.push(`${path} : « ${label} » -> ${Array.from(new Set(writes)).join(', ')}`);
          await page.keyboard.press('Escape').catch(() => {});
        }
      }
      attachReport(testInfo, 'pages-' + role.key, report);
      // À relire : chaque écriture faite d'un seul toucher doit être voulue
      // (pointer une arrivée : oui ; désactiver un compte : non).
      attachReport(testInfo, 'ecritures-en-un-toucher-' + role.key, oneTapWrites);
      // Le balayage ne doit jamais avoir désactivé ou verrouillé son propre compte.
      const me = await request.get(DB + '/users?select=active,failed_login_attempts&nom_affichage=eq.' + encodeURIComponent(role.name), { headers: { apikey: SERVICE, Authorization: 'Bearer ' + SERVICE } });
      const [account] = (await me.json()) as { active: boolean }[];
      if (!account?.active) problems.push(`le compte ${role.name} a été désactivé par un simple clic`);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});
