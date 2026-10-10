import { expect, type Page, type TestInfo } from '@playwright/test';

export const ROLES = [
  { key: 'admin', name: 'QA Admin', pin: '1111', landing: '/scan' },
  { key: 'directeur', name: 'QA Directeur', pin: '2222', landing: '/dashboard' },
  { key: 'placeur', name: 'QA Placeur', pin: '3333', landing: '/scan' },
  { key: 'agent_checkin', name: 'QA Scanneur', pin: '4444', landing: '/scan' },
  { key: 'visibilite', name: 'QA Approbateur', pin: '5555', landing: '/dashboard' },
] as const;
export type QaRole = (typeof ROLES)[number];

/** Connexion rapide (API) + thème déjà choisi : pour les tests hors « première fois ». */
export async function quickLogin(page: Page, role: QaRole) {
  const res = await page.request.post('/api/auth/login', { data: { mode: 'pin', nom_affichage: role.name, pin: role.pin } });
  expect(res.ok(), `connexion ${role.key}`).toBeTruthy();
  await page.addInitScript(() => window.localStorage.setItem('checkin-theme-chosen', '1'));
}

/** Surveille tout ce qui doit faire échouer un test : erreurs JS, erreurs serveur, appels API refusés. */
export function watchProblems(page: Page) {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push('erreur JS : ' + e.message));
  page.on('response', (r) => {
    const url = new URL(r.url());
    if (r.status() >= 500) problems.push(`HTTP ${r.status()} ${url.pathname}`);
    if (url.pathname.startsWith('/api/') && (r.status() === 401 || r.status() === 403)) problems.push(`API refusée ${r.status()} ${url.pathname}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && !/realtime|websocket|WebSocket|favicon|Failed to load resource/i.test(m.text())) problems.push('console : ' + m.text().slice(0, 200));
  });
  return problems;
}

/** Mesure les sauts de mise en page (CLS) depuis le chargement. */
export async function installClsProbe(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
        if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
}

export async function cls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __cls: number }).__cls ?? 0);
}

export function attachReport(testInfo: TestInfo, name: string, lines: string[]) {
  testInfo.attachments.push({ name, contentType: 'text/plain', body: Buffer.from(lines.join('\n') || 'rien à signaler') });
}

const SERVICE = () => process.env.SUPABASE_SERVICE_ROLE_KEY!;
const REST = () => process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1';

/** Lecture/écriture directe de la base de TEST (préparer un cas, vérifier un résultat). */
export async function db<T = Record<string, unknown>>(
  request: import('@playwright/test').APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  data?: unknown
): Promise<T[]> {
  const res = await request.fetch(REST() + path, {
    method,
    data,
    headers: { apikey: SERVICE(), Authorization: 'Bearer ' + SERVICE(), Prefer: 'return=representation', 'Content-Type': 'application/json' },
  });
  expect(res.ok(), `${method} ${path} : ${res.status()} ${await res.text()}`).toBeTruthy();
  return (await res.json()) as T[];
}
