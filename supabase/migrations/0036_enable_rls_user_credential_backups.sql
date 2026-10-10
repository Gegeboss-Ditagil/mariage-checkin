-- ============================================================================
-- Active RLS sur public.user_credential_backups -- signale par l'advisor de
-- securite Supabase des le debut de ce chantier (30/08/2026) : table dans le
-- schema public, RLS DESACTIVEE, donc entierement exposee aux roles anon/
-- authenticated utilises par les librairies client Supabase (contrairement a
-- "RLS activee sans policy", qui refuse tout par defaut -- ici, rien ne
-- refusait quoi que ce soit).
--
-- Cette table n'est reference nulle part dans le code ou les migrations de
-- ce depot (verifie par recherche complete) -- ni creee ni utilisee par
-- cette application. Aucune policy ajoutee : meme posture que toutes les
-- autres tables sensibles de ce depot (users, audit_logs, import_backups,
-- invitations_backup_*, placement_status_backup_*) -- RLS activee, zero
-- policy, donc refus par defaut a anon/authenticated, acces reserve a
-- service_role (bypasse RLS). Pas de policy basee sur auth.uid() : cette
-- application n'utilise pas Supabase Auth (session PIN/cookie maison, voir
-- lib/session.ts), auth.uid() serait toujours nul ici.
-- ============================================================================

-- v1.76.0 : la table avait été créée à la main en production, sans migration
-- (découvert en rejouant toutes les migrations sur une base vide, pile de test
-- scripts/qa-stack/). Même structure que la production ; sans effet là-bas.
create table if not exists public.user_credential_backups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reason text,
  snapshot jsonb
);

alter table public.user_credential_backups enable row level security;
