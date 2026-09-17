import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { logServerEvent, logServerError } from '../lib/serverLog.ts';

// v1.53.20, demande explicite de Gersom (17/09/2026) : "implemente un
// systeme de logs complets que tu peux par la suite analyser pour les
// erreurs et autres, pour t'aider a te corriger et optimiser le systeme
// quand on fait des corrections ou autres." Voir supabase/migrations/
// 0057_app_logs.sql (table), lib/serverLog.ts (ecriture serveur),
// app/api/public/logs/route.ts (ingestion client, sans session requise),
// lib/clientLog.ts + components/GlobalErrorLogger.tsx (capture client),
// app/admin/logs/page.tsx (lecture, admin uniquement).

test('logServerEvent/logServerError ne rejettent jamais, meme sans SESSION/SUPABASE configures (best-effort garanti)', async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    // createAdminClient() lance une erreur explicite sans ces variables --
    // logServerEvent doit l'avaler silencieusement, jamais la laisser
    // remonter a l'appelant (un `catch` de route API ne doit jamais planter
    // a cause du systeme de logs lui-meme).
    await assert.doesNotReject(() => logServerEvent({ message: 'test sans config' }));
    assert.doesNotThrow(() => logServerError(new Error('test sans config (sync)')));
  } finally {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  }
});

test('la migration 0057_app_logs.sql cree la table avec RLS activee et sans policy (meme posture que audit_logs/import_backups)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/0057_app_logs.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table if not exists public\.app_logs/);
  assert.match(sql, /source text not null check \(source in \('client', 'server'\)\)/);
  assert.match(sql, /level text not null default 'error' check \(level in \('error', 'warn', 'info'\)\)/);
  assert.match(sql, /alter table public\.app_logs enable row level security;/);
  assert.doesNotMatch(sql, /create policy/i);
});

test('POST /api/public/logs est accessible sans session (chemin sous /api/public, deja public dans middleware.ts) et exige un message', () => {
  const middlewareSource = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
  assert.match(middlewareSource, /'\/api\/public'/);

  const routeSource = readFileSync(new URL('../app/api/public/logs/route.ts', import.meta.url), 'utf8');
  assert.match(routeSource, /message requis/);
  assert.match(routeSource, /MAX_BODY_BYTES/);
  assert.match(routeSource, /getSessionUser\(\)/);
  // La session est lue en best-effort, jamais exigee (pas de 401 renvoye).
  assert.doesNotMatch(routeSource, /status: 401/);
  assert.match(routeSource, /source: 'client'/);
});

test('lib/clientLog.ts deduplique par fenetre de 10s et prefere sendBeacon a fetch', () => {
  const source = readFileSync(new URL('../lib/clientLog.ts', import.meta.url), 'utf8');
  assert.match(source, /DEDUPE_WINDOW_MS = 10_000/);
  assert.match(source, /navigator\.sendBeacon/);
  assert.match(source, /keepalive: true/);
});

test('GlobalErrorLogger capture window.onerror ET unhandledrejection, monte une seule fois dans app/layout.tsx', () => {
  const loggerSource = readFileSync(new URL('../components/GlobalErrorLogger.tsx', import.meta.url), 'utf8');
  assert.match(loggerSource, /addEventListener\('error', onError\)/);
  assert.match(loggerSource, /addEventListener\('unhandledrejection', onRejection\)/);
  assert.match(loggerSource, /removeEventListener\('error', onError\)/);
  assert.match(loggerSource, /removeEventListener\('unhandledrejection', onRejection\)/);

  const layoutSource = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(layoutSource, /import \{ GlobalErrorLogger \} from '@\/components\/GlobalErrorLogger';/);
  assert.match(layoutSource, /<GlobalErrorLogger \/>/);
});

test('app/error.tsx et app/global-error.tsx signalent toute erreur capturee au systeme de logs', () => {
  const errorSource = readFileSync(new URL('../app/error.tsx', import.meta.url), 'utf8');
  assert.match(errorSource, /reportClientError/);

  const globalErrorSource = readFileSync(new URL('../app/global-error.tsx', import.meta.url), 'utf8');
  assert.match(globalErrorSource, /fetch\('\/api\/public\/logs'/);
});

test('/admin/logs est reserve a l\'admin (lecture seule) via GET /api/admin/logs', () => {
  const routeSource = readFileSync(new URL('../app/api/admin/logs/route.ts', import.meta.url), 'utf8');
  assert.match(routeSource, /user\.role !== 'admin'/);
  assert.match(routeSource, /status: 401/);
  assert.match(routeSource, /\.eq\('event_id', user\.event_id\)/);
  assert.doesNotMatch(routeSource, /\.insert\(/, 'la route admin ne doit etre que lecture seule');

  const pageSource = readFileSync(new URL('../app/admin/logs/page.tsx', import.meta.url), 'utf8');
  assert.match(pageSource, /\/api\/admin\/logs/);

  const adminHomeSource = readFileSync(new URL('../app/admin/page.tsx', import.meta.url), 'utf8');
  assert.match(adminHomeSource, /href="\/admin\/logs"/);
});
