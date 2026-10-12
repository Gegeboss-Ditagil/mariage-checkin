-- ============================================================================
-- 11/10/2026 -- historique des migrations de production : remettre 0074, 0075
-- et 0076 sous leur version a 4 chiffres (elles avaient ete appliquees avec
-- apply_migration, qui les a inscrites sous des versions horodatees
-- 20261011020937 / 20261011023516 / 20261011023933), et donner un nom complet
-- a 0072 et 0073. Seule la table d'historique change : aucune donnee metier.
--
-- A executer par Gersom dans l'editeur SQL Supabase (contient un DELETE sur
-- l'historique). Sauvegarde de l'historique creee d'abord ; retour arriere :
--   truncate supabase_migrations.schema_migrations;
--   insert into supabase_migrations.schema_migrations
--     select * from supabase_migrations.schema_migrations_backup_20261011;
-- Idempotente : rejouee, elle ne change rien.
-- ============================================================================

create table if not exists supabase_migrations.schema_migrations_backup_20261011 as
  select * from supabase_migrations.schema_migrations;

insert into supabase_migrations.schema_migrations (version, name, created_by)
select v.version, v.name, 'gersom/11-10-2026 (renumerotation)'
from (values
  ('0074', '0074_sync_guest_list_68_name_tags'),
  ('0075', '0075_culumbu_names_dikalvin'),
  ('0076', '0076_table7_gloria_juliana_remove_nedy')
) as v(version, name)
on conflict (version) do nothing;

delete from supabase_migrations.schema_migrations
where version in ('20261011020937', '20261011023516', '20261011023933');

update supabase_migrations.schema_migrations
set name = '0072_sync_guest_list_66_seatplan_20261010'
where version = '0072' and name = 'sync_guest_list_66_seatplan_20261010';

update supabase_migrations.schema_migrations
set name = '0073_sync_guest_list_67'
where version = '0073' and name = 'sync_guest_list_67';

-- Verification : doit donner 0 ligne non a 4 chiffres.
select count(*) as total,
       count(*) filter (where version !~ '^[0-9]{4}$') as non_4_chiffres
from supabase_migrations.schema_migrations;
