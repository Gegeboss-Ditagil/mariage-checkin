-- v1.48.6, demande de Gersom le 14/09/2026 : "ajoute a la logique de seats
-- id... assure-toi que chaque siege a son id et fait match avec l'invite id"
-- -- en analysant guest-list_50.csv (transmis pour "donner une idee" avant le
-- futur import final), la colonne "party" de With Joy (ex.
-- "table-002-party-006") reste IDENTIQUE pour la meme personne entre deux
-- exports differents (verifie sur guest-list_48.csv et guest-list_50.csv,
-- Pajos Mpapa) -- un identifiant stable, independant du nom, contrairement au
-- numero de table qu'il contient parfois.
--
-- ATTENTION, decouverte pendant la meme analyse : ce numero de table
-- ("table-XXX" dans la valeur de "party") ne correspond PAS forcement a la
-- vraie table -- verifie sur les 39 groupes de guest-list_50.csv, seulement
-- environ un tiers correspondent au vrai tag de table (F0xx/T0xx). C'est un
-- identifiant interne a l'outil de placement de With Joy (une fonctionnalite
-- distincte de celle qui produit les tags F0xx/T0xx que notre import utilise
-- deja), pas notre numerotation de table. Cette colonne sert donc UNIQUEMENT
-- a retrouver/mettre a jour la meme invitation d'un import a l'autre --
-- jamais une source de placement (qui reste le tag F0xx/T0xx de la colonne
-- "tags", deja utilise par lib/withjoyImport.ts, inchange).
alter table invitations add column if not exists withjoy_party_id text;

comment on column invitations.withjoy_party_id is
  'Valeur brute de la colonne "party" de l''export With Joy (ex. table-002-party-006, sans-table-party-238, ou un identifiant person-invitee-...) -- stable entre deux exports pour la meme personne/le meme groupe, sert uniquement a retrouver une invitation existante lors d''un futur import (au lieu de deviner par nom). Le numero de table qu''elle contient parfois est un identifiant interne a With Joy, PAS notre numero de table reel -- ne jamais l''utiliser pour le placement (voir lib/withjoyImport.ts, qui continue de lire le tag F0xx/T0xx de la colonne "tags").';

-- L'import complet (/admin/import-withjoy, admin_replace_invitations,
-- 0026_import_replace_invitations.sql) doit desormais aussi ecrire cette
-- colonne -- redefinition complete de la fonction (meme corps que 0026, sauf
-- la colonne ajoutee) pour rester reproductible depuis Git.
create or replace function admin_replace_invitations(
  p_event_id uuid,
  p_invitations jsonb,
  p_agent_id uuid,
  p_expected_before_count int,
  p_expected_fingerprint text
) returns jsonb as $$
declare
  v_backup_id uuid;
  v_before_count int;
  v_inserted_count int;
  v_row jsonb;
  v_snapshot jsonb;
  v_current_fingerprint text;
begin
  -- Sérialise les imports et les changements de statut de l'événement.
  perform 1 from events where id = p_event_id for update;
  if not found then raise exception 'event_not_found'; end if;

  if jsonb_typeof(p_invitations) <> 'array' or jsonb_array_length(p_invitations) = 0 then
    raise exception 'empty_import_forbidden';
  end if;

  select count(*) into v_before_count from invitations where event_id = p_event_id;
  if v_before_count <> p_expected_before_count then
    raise exception 'import_source_changed';
  end if;
  select admin_import_invitations_state(p_event_id)->>'fingerprint' into v_current_fingerprint;
  if v_current_fingerprint is distinct from p_expected_fingerprint then
    raise exception 'import_source_changed';
  end if;

  -- Sauvegarde les invitations ET les données qui seraient supprimées en
  -- cascade. Les journaux/exceptions restent en base mais leur lien peut être
  -- mis à NULL par la suppression : ils sont aussi inclus pour un rollback.
  select jsonb_build_object(
    'version', 1,
    'invitations', coalesce((select jsonb_agg(to_jsonb(i)) from invitations i where i.event_id = p_event_id), '[]'::jsonb),
    'invitation_guests', coalesce((select jsonb_agg(to_jsonb(ig)) from invitation_guests ig join invitations i on i.id = ig.invitation_id where i.event_id = p_event_id), '[]'::jsonb),
    'guests', coalesce((select jsonb_agg(to_jsonb(g)) from guests g where g.event_id = p_event_id), '[]'::jsonb),
    'checkins', coalesce((select jsonb_agg(to_jsonb(c)) from checkins c where c.event_id = p_event_id), '[]'::jsonb),
    'overflow_assignments', coalesce((select jsonb_agg(to_jsonb(o)) from overflow_assignments o where o.event_id = p_event_id), '[]'::jsonb),
    'exceptions', coalesce((select jsonb_agg(to_jsonb(e)) from exceptions e where e.event_id = p_event_id), '[]'::jsonb),
    'audit_logs', coalesce((select jsonb_agg(to_jsonb(a)) from audit_logs a where a.event_id = p_event_id), '[]'::jsonb)
  ) into v_snapshot;

  insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    values (p_event_id, p_agent_id, v_snapshot, v_before_count)
    returning id into v_backup_id;

  delete from invitations where event_id = p_event_id;
  delete from guests where event_id = p_event_id;

  for v_row in select * from jsonb_array_elements(p_invitations)
  loop
    if nullif(trim(v_row->>'nom_affichage'), '') is null then
      raise exception 'invalid_invitation_name';
    end if;
    if coalesce((v_row->>'nombre_prevu')::int, 0) <= 0 then
      raise exception 'invalid_invitation_size';
    end if;
    if nullif(v_row->>'table_id', '') is not null and not exists (
      select 1 from tables t
      where t.id = (v_row->>'table_id')::uuid and t.event_id = p_event_id
    ) then
      raise exception 'invalid_table_for_event';
    end if;

    insert into invitations (
      event_id, table_id, nom_affichage, groupe, nombre_prevu, telephone,
      email, notes, tags, cote, category, placement_status, withjoy_party_id
    ) values (
      p_event_id,
      nullif(v_row->>'table_id', '')::uuid,
      trim(v_row->>'nom_affichage'),
      nullif(trim(v_row->>'groupe'), ''),
      (v_row->>'nombre_prevu')::int,
      nullif(trim(v_row->>'telephone'), ''),
      nullif(trim(v_row->>'email'), ''),
      nullif(trim(v_row->>'notes'), ''),
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(v_row->'tags', '[]'::jsonb)) x), '{}'::text[]),
      nullif(v_row->>'cote', ''),
      nullif(v_row->>'category', ''),
      coalesce(nullif(v_row->>'placement_status', ''), 'provisoire'),
      nullif(trim(v_row->>'withjoy_party_id'), '')
    );
  end loop;

  select count(*) into v_inserted_count from invitations where event_id = p_event_id;
  if v_inserted_count <> jsonb_array_length(p_invitations) then
    raise exception 'import_count_mismatch';
  end if;

  insert into audit_logs (event_id, action, agent_id, details)
    values (
      p_event_id, 'import_withjoy_replace', p_agent_id,
      jsonb_build_object(
        'invitations_avant', v_before_count,
        'invitations_apres', v_inserted_count,
        'backup_id', v_backup_id
      )
    );

  return jsonb_build_object(
    'invitations_avant', v_before_count,
    'invitations_apres', v_inserted_count,
    'backup_id', v_backup_id
  );
end;
$$ language plpgsql security invoker set search_path = public, pg_temp;

revoke all on function admin_replace_invitations(uuid, jsonb, uuid, int, text) from public, anon, authenticated;
grant execute on function admin_replace_invitations(uuid, jsonb, uuid, int, text) to service_role;
