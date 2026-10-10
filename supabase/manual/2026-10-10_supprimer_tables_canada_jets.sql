-- ============================================================================
-- 10/10/2026 -- demande de Gersom : « supprime les tables canada jets aussi ».
-- Tables d'un autre projet (Canada Jets) créées par erreur dans la base du
-- mariage (migration hors dépôt « canada_jets_leads_pipeline », 21/09/2026).
-- Vérifiées le 10/10/2026 : vides, aucune contrainte, vue, fonction ni
-- déclencheur qui en dépende. À EXÉCUTER dans l'éditeur SQL Supabase
-- (l'outil de l'agent expire sur toute suppression).
-- Retour arrière : le SQL de création est conservé dans
--   select array_to_string(statements, E'\n')
--     from supabase_migrations.schema_migrations_backup_20261010
--     where name = 'canada_jets_leads_pipeline';
-- ============================================================================

begin;

-- Garde-fou : s'arrête sans rien supprimer si une ligne est apparue entre-temps.
do $$
begin
  if (select count(*) from public.canada_jets_leads) > 0
     or (select count(*) from public.canada_jets_lead_events) > 0 then
    raise exception 'Tables canada_jets non vides : suppression annulée';
  end if;
end $$;

drop table public.canada_jets_lead_events;
drop table public.canada_jets_leads;

commit;

-- Vérification : doit renvoyer 0
select count(*) from pg_tables where schemaname = 'public' and tablename like 'canada_jets%';
