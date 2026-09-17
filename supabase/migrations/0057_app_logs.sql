-- ============================================================================
-- Systeme de logs applicatifs -- demande explicite de Gersom (17/09/2026) :
-- "implemente un systeme de logs complets que tu peux par la suite analyser
-- pour les erreurs et autres, pour t'aider a te corriger et optimiser le
-- systeme quand on fait des corrections ou autres."
--
-- Jusqu'ici, une erreur cote client (bug de rendu, exception non geree) ou
-- cote serveur (route API) ne laissait aucune trace consultable apres coup --
-- seuls les logs ephemeres de la console du navigateur/Vercel, perdus des que
-- l'onglet se ferme ou que le build tourne. `app_logs` centralise ces
-- evenements dans Supabase, interrogeable directement (par un futur agent
-- via SQL, ou par Gersom via `/admin/logs`) pour diagnostiquer un bug signale
-- ou verifier qu'un correctif a bien arrete une erreur qui se repetait.
--
-- RLS activee SANS policy anon/authenticated -- meme posture que
-- `audit_logs`/`import_backups`/`user_credential_backups` : cette
-- application n'utilise pas Supabase Auth (session PIN/cookie maison), toute
-- lecture/ecriture passe exclusivement par des routes API server-side avec
-- la cle service_role (`lib/supabase/admin.ts`), jamais directement depuis
-- le navigateur.
create table if not exists public.app_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete set null,
  -- 'client' : erreur de rendu React (app/error.tsx, app/global-error.tsx) ou
  -- erreur globale non geree (window.onerror/onunhandledrejection).
  -- 'server' : route API/fonction serveur, via lib/serverLog.ts.
  source text not null check (source in ('client', 'server')),
  level text not null default 'error' check (level in ('error', 'warn', 'info')),
  -- Chemin de la page (client) ou de la route API (serveur) concernee.
  path text,
  message text not null,
  stack text,
  -- digest Next.js (app/error.tsx) : correle un log a l'ecran d'erreur
  -- exact vu par l'utilisateur (Next.js l'affiche aussi discretement a
  -- l'ecran), sans jamais exposer la stack complete a l'utilisateur.
  digest text,
  -- Contexte libre : role/nom de l'utilisateur, user-agent, identifiants
  -- pertinents (invitation_id, table_id...) selon le point d'appel --
  -- jamais de secret (mot de passe, PIN, jeton de session).
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists app_logs_event_id_created_at_idx on public.app_logs (event_id, created_at desc);
create index if not exists app_logs_source_level_idx on public.app_logs (source, level);

alter table public.app_logs enable row level security;

comment on table public.app_logs is
  'Logs applicatifs (erreurs client/serveur) pour diagnostic apres coup -- ecriture/lecture exclusivement via service_role, voir lib/serverLog.ts et POST /api/logs.';
