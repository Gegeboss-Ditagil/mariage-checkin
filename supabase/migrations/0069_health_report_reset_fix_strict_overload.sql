-- ============================================================================
-- v1.75.0 (10/10/2026) -- suite de l'analyse « pourquoi nos tests n'ont pas vu
-- ces erreurs » demandée par Gersom.
--
-- 1) assign_table_to_guest_approval_strict existait en DEUX versions en
--    production : 0038 (4 paramètres) n'a jamais été supprimée quand 0049 a
--    ajouté p_force. Un appel à 3 arguments était ambigu (« function ... is
--    not unique ») : approuver une demande avec table réservée (dont tout le
--    parcours « Reconsidérer -> choisir une table ») la laissait approuvée SANS
--    table. Le code passe désormais tous les arguments ; on retire en plus
--    l'ancienne version pour qu'aucun appel futur ne retombe dans le piège.
--
-- 2) reset_test_event_data (0047) n'avait jamais été appliquée : le bouton
--    « Réinitialiser les données de test » de /admin échouait. Recréée,
--    adaptée au pointage par personne (v1.29+) : remet aussi les personnes
--    « arrivées » à « attendu » et retire les personnes ajoutées sur place
--    (is_unplanned), sinon les compteurs repartaient à 0 avec des personnes
--    encore cochées. Toujours refusée en mode « live ».
--
-- 3) app_health_report() : contrôle de santé en LECTURE SEULE (aucune
--    écriture) appelé par /api/admin/health et la carte « Santé de la base »
--    de /admin. Vérifie que chaque fonction appelée par le code existe en une
--    seule version, que les colonnes/tables attendues existent, et les règles
--    de données (lignes nominatives <= places, tables en surcapacité, doublons
--    de personnes, réserves 1 et 42, demandes approuvées réservées sans table).
--    La liste des fonctions est tenue à jour par tests/db-health-report.test.ts
--    (échoue si le code appelle une fonction absente de cette liste).
-- ============================================================================

drop function if exists assign_table_to_guest_approval_strict(uuid, uuid, uuid, jsonb);

create or replace function reset_test_event_data(p_event_id uuid)
returns void as $$
declare
  v_status text;
begin
  select status into v_status
    from events
    where id = p_event_id
    for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  if v_status = 'live' then
    raise exception 'event_live';
  end if;

  delete from checkins where event_id = p_event_id;
  delete from overflow_assignments where event_id = p_event_id;
  delete from exceptions where event_id = p_event_id;
  delete from audit_logs where event_id = p_event_id;

  -- Personnes ajoutées sur place pendant les tests : retirées.
  delete from guests g
    using invitation_guests ig, invitations i
    where ig.guest_id = g.id and ig.invitation_id = i.id
      and i.event_id = p_event_id and g.is_unplanned;

  -- Pointage par personne remis à « attendu » (« ne viendra pas » conservé :
  -- c'est une donnée de préparation, pas un test d'arrivée).
  update guests g
    set arrival_status = 'attendu'
    from invitation_guests ig, invitations i
    where ig.guest_id = g.id and ig.invitation_id = i.id
      and i.event_id = p_event_id and g.arrival_status = 'arrive';

  update invitations
    set nombre_arrive = 0,
        nombre_supplementaire = 0,
        statut = 'non_arrive',
        updated_at = now()
    where event_id = p_event_id;
end;
$$ language plpgsql security invoker set search_path = public, pg_temp;

create or replace function app_health_report()
returns table (check_name text, ok boolean, detail text) as $$
declare
  v_expected_functions text[] := array[
    'add_invitation_member', 'add_invitation_tag', 'add_unplanned_arrival',
    'admin_import_invitations_state', 'admin_replace_invitations',
    'assign_overflow', 'assign_table_to_guest_approval_strict',
    'auto_assign_table_for_guest_approval', 'cancel_last_checkin',
    'ensure_invitation_member_rows', 'initialize_invitation_members',
    'merge_invitations', 'move_invitation_table', 'move_invitations_table',
    'move_overflow', 'record_checkin', 'release_guest_approval_reservation',
    'remove_invitation_member', 'remove_invitation_tag', 'rename_invitation',
    'rename_invitation_member', 'reserve_table_for_guest_approval',
    'reset_test_event_data', 'set_guest_arrival_status', 'set_invitation_no_show',
    'split_guest_to_new_invitation', 'swap_invitations_between_tables',
    'unassign_overflow'
  ];
  v_expected_columns text[] := array[
    'events.twilio_enabled', 'events.status',
    'guests.arrival_status', 'guests.is_unplanned',
    'invitations.withjoy_party_id', 'invitations.ne_viendra_pas',
    'tables.is_reserve',
    'agenda_items.is_private', 'agenda_items.custom_assignees',
    'guest_approval_requests.reserved_table_id', 'guest_approval_requests.linked_invitation_id',
    'users.failed_login_attempts', 'users.locked_until', 'users.is_super_admin',
    'users.pin_reset_hint', 'users.phone',
    'app_logs.context', 'push_subscriptions.endpoint'
  ];
  v_name text;
  v_count int;
  v_detail text;
begin
  -- Fonctions appelées par le code : exactement une version chacune.
  foreach v_name in array v_expected_functions loop
    select count(*) into v_count
      from pg_proc p where p.proname = v_name and p.pronamespace = 'public'::regnamespace;
    check_name := 'fonction ' || v_name;
    ok := v_count = 1;
    detail := case when v_count = 0 then 'absente (migration non appliquée ?)'
                   when v_count > 1 then v_count || ' versions : appel ambigu possible'
                   else 'ok' end;
    return next;
  end loop;

  -- Colonnes attendues.
  foreach v_name in array v_expected_columns loop
    select count(*) into v_count
      from information_schema.columns
      where table_schema = 'public'
        and table_name = split_part(v_name, '.', 1)
        and column_name = split_part(v_name, '.', 2);
    check_name := 'colonne ' || v_name;
    ok := v_count = 1;
    detail := case when v_count = 1 then 'ok' else 'absente (migration non appliquée ?)' end;
    return next;
  end loop;

  -- La décision depuis l'application ('app') doit être acceptée (0037).
  check_name := 'contrainte decided_via accepte app';
  select coalesce(bool_or(pg_get_constraintdef(c.oid) like '%app%'), false) into ok
    from pg_constraint c where c.conname = 'guest_approval_requests_decided_via_check';
  detail := case when ok then 'ok' else 'la décision depuis l''app serait refusée' end;
  return next;

  -- Réserves = tables 1 et 42 (v1.72.0).
  check_name := 'réserves = tables 1 et 42';
  select string_agg(number::text, ',' order by number) into v_detail
    from tables where is_reserve and capacity > 0;
  ok := coalesce(v_detail, '') = '1,42';
  detail := 'réserves actuelles : ' || coalesce(v_detail, 'aucune');
  return next;

  -- Lignes nominatives au-delà des places prévues/arrivées.
  check_name := 'lignes nominatives <= places';
  select string_agg(nom, ', '), count(*) into v_detail, v_count from (
    select i.nom_affichage || ' (' || count(*) || ' pour ' || greatest(i.nombre_prevu, i.nombre_arrive) || ')' as nom
      from invitations i
      join invitation_guests ig on ig.invitation_id = i.id
      join guests g on g.id = ig.guest_id
      where g.arrival_status <> 'ne_viendra_pas'
      group by i.id
      having count(*) > greatest(i.nombre_prevu, i.nombre_arrive)
  ) x;
  ok := v_count = 0;
  detail := case when ok then 'ok' else v_detail end;
  return next;

  -- Tables en surcapacité (même calcul que lib/capacity.ts).
  check_name := 'aucune table en surcapacité';
  select string_agg('table ' || number || ' (' || occ || '/' || capacity || ')', ', ' order by number), count(*)
    into v_detail, v_count from (
    select t.number, t.capacity,
      coalesce((select sum(case when i.ne_viendra_pas then i.nombre_arrive else greatest(i.nombre_prevu, i.nombre_arrive) end
                         - least(coalesce((select sum(o.nombre_personnes) from overflow_assignments o where o.invitation_id = i.id), 0),
                                 greatest(i.nombre_arrive - i.nombre_prevu, 0)))
                from invitations i where i.table_id = t.id), 0)
      + coalesce((select sum(o.nombre_personnes) from overflow_assignments o where o.reserve_table_id = t.id), 0) as occ
    from tables t where t.capacity > 0
  ) x where occ > capacity;
  ok := v_count = 0;
  detail := case when ok then 'ok' else v_detail end;
  return next;

  -- Même personne dans deux invitations différentes (doublon probable).
  check_name := 'aucun doublon de personne entre invitations';
  select string_agg(n, ', '), count(*) into v_detail, v_count from (
    select lower(trim(g.nom_affichage)) as n
      from guests g join invitation_guests ig on ig.guest_id = g.id
      where g.arrival_status <> 'ne_viendra_pas'
        and g.nom_affichage !~* '^(accompagnant|invité de|excédent)'
      group by lower(trim(g.nom_affichage))
      having count(distinct ig.invitation_id) > 1
  ) x;
  ok := v_count = 0;
  detail := case when ok then 'ok' else v_detail end;
  return next;

  -- Demande approuvée avec une table réservée mais jamais placée.
  check_name := 'aucune demande approuvée réservée sans table';
  select count(*) into v_count from guest_approval_requests
    where statut = 'approuve' and reserved_table_id is not null and table_id is null;
  ok := v_count = 0;
  detail := case when ok then 'ok' else v_count || ' demande(s) approuvée(s) restée(s) sans table' end;
  return next;

  -- Compteur d'arrivées cohérent avec le pointage par personne.
  check_name := 'compteur d''arrivées = personnes cochées';
  select string_agg(nom_affichage, ', '), count(*) into v_detail, v_count from (
    select i.nom_affichage
      from invitations i join invitation_guests ig on ig.invitation_id = i.id join guests g on g.id = ig.guest_id
      group by i.id
      having i.nombre_arrive <> count(*) filter (where g.arrival_status = 'arrive')
  ) x;
  ok := v_count = 0;
  detail := case when ok then 'ok' else v_detail end;
  return next;
end;
$$ language plpgsql stable security invoker set search_path = public, pg_temp;
