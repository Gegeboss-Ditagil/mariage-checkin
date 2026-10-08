-- ============================================================================
-- v1.72.1 (08/10/2026) -- constat de la QA par rôle, confirmé par Gersom :
-- « les comptes Placeur014, Placeur015 et Placeur016 ... sont supposés être
-- des placeurs » -- ils avaient le rôle agent_checkin (scanner).
--
-- Les deux rôles se connectent par PIN : le PIN existant reste valide, rien
-- d'autre ne change. Le rôle étant porté par la session signée, le nouveau
-- rôle s'applique à la PROCHAINE connexion de chaque compte.
--
-- Sauvegarde des trois lignes avant modification (sans aucun secret : id,
-- nom, rôle) dans import_backups (snapshot->>'kind' = 'v1.72.1_placeurs').
-- Idempotente.
-- ============================================================================

do $$
declare
  v_event uuid;
begin
  select id into v_event from events limit 1;

  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.72.1_placeurs') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.72.1_placeurs',
      'users', (select jsonb_agg(jsonb_build_object('id', id, 'nom_affichage', nom_affichage, 'role', role))
                from users where nom_affichage in ('Placeur014', 'Placeur015', 'Placeur016'))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  update users
  set role = 'placeur'
  where nom_affichage in ('Placeur014', 'Placeur015', 'Placeur016')
    and role = 'agent_checkin' and password_hash is null;
end $$;
