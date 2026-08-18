-- ============================================================================
-- Wedding Check-in — schema initial
-- A executer dans Supabase > SQL Editor (ou via la CLI supabase db push)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- events : un mariage = un evenement (permet de reutiliser l'outil plus tard)
-- ---------------------------------------------------------------------------
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date,
  status text not null default 'setup' check (status in ('setup', 'test', 'live', 'closed')),
  reserve_table_capacity int not null default 10,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tables : tables physiques de la salle (1-36 normales, 37-40 reserve)
-- ---------------------------------------------------------------------------
create table if not exists tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  number int not null,
  label text, -- ex: nom de ville, "Vol T012"
  capacity int not null default 10,
  is_reserve boolean not null default false,
  zone text, -- ex: "Zone A" (optionnel, phase placement)
  created_at timestamptz not null default now(),
  unique (event_id, number)
);

-- ---------------------------------------------------------------------------
-- guests : personnes individuelles (peuvent appartenir a un groupe)
-- ---------------------------------------------------------------------------
create table if not exists guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  nom text,
  prenom text,
  nom_affichage text not null,
  telephone text,
  email text,
  vip boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- invitations : l'unite qui se presente a l'entree (une personne seule ou un
-- groupe/famille). C'est CETTE table qui porte le nombre prevu / arrive.
-- ---------------------------------------------------------------------------
create table if not exists invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  table_id uuid references tables(id) on delete set null,
  nom_affichage text not null,       -- "Mathieu", "Famille Kabila"
  groupe text,                        -- nom de famille / groupe si applicable
  nombre_prevu int not null default 1 check (nombre_prevu >= 0),
  nombre_arrive int not null default 0 check (nombre_arrive >= 0),
  nombre_supplementaire int not null default 0 check (nombre_supplementaire >= 0),
  statut text not null default 'non_arrive'
    check (statut in ('non_arrive', 'partiel', 'complet', 'excedent')),
  category text, -- ex: 'F' (famille), 'T' (soiree), 'M' (mairie+mariage) — libre
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invitations_table on invitations(table_id);
create index if not exists idx_invitations_event on invitations(event_id);
create index if not exists idx_invitations_search
  on invitations using gin (to_tsvector('french', coalesce(nom_affichage,'') || ' ' || coalesce(groupe,'')));

-- Lien optionnel guest <-> invitation (une invitation peut regrouper plusieurs guests)
create table if not exists invitation_guests (
  invitation_id uuid not null references invitations(id) on delete cascade,
  guest_id uuid not null references guests(id) on delete cascade,
  primary key (invitation_id, guest_id)
);

-- ---------------------------------------------------------------------------
-- qr_codes : associe un identifiant/URL scanne a une table
-- ---------------------------------------------------------------------------
create table if not exists qr_codes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  code text not null,                -- identifiant contenu dans le QR (ex: "table-12" ou une URL complete)
  table_id uuid not null references tables(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, code)
);

-- ---------------------------------------------------------------------------
-- checkins : chaque enregistrement d'arrivee (peut y en avoir plusieurs par
-- invitation si les gens arrivent en plusieurs fois)
-- ---------------------------------------------------------------------------
create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  invitation_id uuid not null references invitations(id) on delete cascade,
  agent_id uuid, -- FK vers users ajoutee plus bas (users est cree apres checkins)
  nombre_personnes int not null check (nombre_personnes > 0),
  ancien_total int not null,
  nouveau_total int not null,
  is_correction boolean not null default false,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_checkins_invitation on checkins(invitation_id);

-- ---------------------------------------------------------------------------
-- overflow_assignments : personnes supplementaires envoyees en table de reserve
-- ---------------------------------------------------------------------------
create table if not exists overflow_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  invitation_id uuid not null references invitations(id) on delete cascade,
  origin_table_id uuid references tables(id),
  reserve_table_id uuid not null references tables(id),
  nombre_personnes int not null check (nombre_personnes > 0),
  agent_id uuid, -- FK vers users ajoutee plus bas (users est cree apres overflow_assignments)
  created_at timestamptz not null default now()
);

create index if not exists idx_overflow_reserve_table on overflow_assignments(reserve_table_id);

-- ---------------------------------------------------------------------------
-- users : comptes de l'equipe (admin / agent_checkin / placeur)
-- PIN et mot de passe stockes hashes (scrypt, voir src/lib/auth.ts)
-- ---------------------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  nom_affichage text not null,       -- "Agent 1", "Placeur 2", "Admin"
  role text not null check (role in ('admin', 'agent_checkin', 'placeur')),
  email text,
  password_hash text,                -- pour admin (email + mot de passe)
  pin_hash text,                     -- pour agents / placeurs (PIN court)
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (event_id, nom_affichage)
);

alter table checkins
  add constraint checkins_agent_fk foreign key (agent_id) references users(id) on delete set null;

alter table overflow_assignments
  add constraint overflow_agent_fk foreign key (agent_id) references users(id) on delete set null;

-- ---------------------------------------------------------------------------
-- audit_logs : journal complet de toutes les actions sensibles
-- ---------------------------------------------------------------------------
create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  action text not null,              -- 'checkin', 'cancel_checkin', 'correction', 'overflow_assign', 'import', etc.
  invitation_id uuid references invitations(id) on delete set null,
  table_id uuid references tables(id) on delete set null,
  agent_id uuid references users(id) on delete set null,
  nombre_personnes int,
  ancien_total int,
  nouveau_total int,
  origin_table_id uuid references tables(id),
  reserve_table_id uuid references tables(id),
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_event_time on audit_logs(event_id, created_at desc);

-- ---------------------------------------------------------------------------
-- trigger updated_at
-- ---------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_invitations_updated_at on invitations;
create trigger trg_invitations_updated_at
  before update on invitations
  for each row execute function set_updated_at();
