-- ============================================================================
-- exceptions : file speciale pour les cas problematiques (spec section 32)
-- ============================================================================
create table if not exists exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  type text not null check (type in (
    'pas_de_qr', 'nom_introuvable', 'nombre_superieur', 'mauvaise_table',
    'invite_non_prevu', 'qr_incorrect', 'deja_marque_entre', 'capacite_insuffisante', 'autre'
  )),
  description text,
  invitation_id uuid references invitations(id) on delete set null,
  table_id uuid references tables(id) on delete set null,
  reported_by uuid references users(id) on delete set null,
  resolved boolean not null default false,
  resolved_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_exceptions_event on exceptions(event_id, resolved);

alter table exceptions enable row level security;
create policy "public read exceptions" on exceptions for select using (true);

alter publication supabase_realtime add table exceptions;
