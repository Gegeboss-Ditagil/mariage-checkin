-- ============================================================================
-- v1.75.0 -- tests de comportement SQL sur la VRAIE base, sans rien y laisser.
-- Tout se passe dans un seul bloc DO qui se termine TOUJOURS par une exception
-- (« SQL_TESTS_PASSED ... » si tout va bien) : PostgreSQL annule alors toutes
-- les écritures du bloc. À lancer dans l'éditeur SQL Supabase (ou via MCP) :
-- le message d'erreur final EST le rapport. Toute autre exception = échec.
--
-- Parcours couverts (premières utilisations réelles) :
--   1. Invité surprise : réserver une table PUIS approuver -> placé sur cette
--      table (bug v1.75.0 : la demande restait approuvée sans table).
--   2. Placement automatique d'une demande approuvée sans réservation.
--   3. Scanneur, première ouverture d'une invitation jamais ouverte : les
--      lignes nominatives sont créées sans toucher aux totaux (bug v1.73.1).
--   4. Pointer une personne arrivée met à jour le compteur de l'invitation.
-- ============================================================================
do $$
declare
  v_event uuid;
  v_table uuid;
  v_req uuid;
  v_req2 uuid;
  v_inv invitations;
  v_target invitations;
  v_guest uuid;
  v_rows int;
  v_report text := '';
begin
  select id into v_event from events limit 1;
  select id into v_table from tables where number = 42 and capacity > 0;
  if v_table is null then raise exception 'SETUP: table 42 introuvable'; end if;

  -- 1. Réserver puis approuver.
  insert into guest_approval_requests (event_id, token, cote, nom_invite, nombre_invites, photo_url, approver_phone)
    values (v_event, 'sqltest-' || gen_random_uuid(), 'Gege', 'SQLTEST Reserve', 1, 'sqltest', '+00')
    returning id into v_req;
  perform reserve_table_for_guest_approval(p_request_id => v_req, p_table_id => v_table, p_agent_id => null);
  update guest_approval_requests set statut = 'approuve', decided_at = now(), decided_via = 'app' where id = v_req;
  -- Même appel que lib/guestApprovalDecide.ts (5 arguments nommés).
  perform assign_table_to_guest_approval_strict(
    p_request_id => v_req, p_table_id => v_table, p_agent_id => null, p_relocations => '[]'::jsonb, p_force => false);
  if not exists (select 1 from guest_approval_requests where id = v_req and table_id = v_table) then
    raise exception 'ECHEC 1: demande réservée puis approuvée non placée sur sa table';
  end if;
  if not exists (select 1 from invitations where nom_affichage = 'SQLTEST Reserve' and table_id = v_table) then
    raise exception 'ECHEC 1: aucune invitation créée à la table réservée';
  end if;
  v_report := v_report || '1 ok; ';

  -- 2. Placement automatique.
  insert into guest_approval_requests (event_id, token, cote, nom_invite, nombre_invites, photo_url, approver_phone, statut, decided_at, decided_via)
    values (v_event, 'sqltest-' || gen_random_uuid(), 'Nelly', 'SQLTEST Auto', 1, 'sqltest', '+00', 'approuve', now(), 'app')
    returning id into v_req2;
  perform auto_assign_table_for_guest_approval(p_request_id => v_req2, p_agent_id => null);
  if not exists (select 1 from guest_approval_requests where id = v_req2 and table_id is not null) then
    v_report := v_report || '2 aucune place libre (accepté : approuvée sans table); ';
  else
    v_report := v_report || '2 ok; ';
  end if;

  -- 3. Première ouverture d'une invitation sans lignes nominatives.
  select i.* into v_target from invitations i
    where i.table_id is not null and i.nombre_prevu > 0 and i.nombre_arrive = 0 and not i.ne_viendra_pas
      and not exists (select 1 from invitation_guests ig where ig.invitation_id = i.id)
    limit 1;
  if v_target.id is null then
    v_report := v_report || '3 ignoré (toutes les invitations ont déjà des lignes); ';
  else
    perform ensure_invitation_member_rows(p_invitation_id => v_target.id, p_agent_id => null);
    select count(*) into v_rows from invitation_guests where invitation_id = v_target.id;
    select * into v_inv from invitations where id = v_target.id;
    if v_rows < v_target.nombre_prevu then
      raise exception 'ECHEC 3: % lignes créées pour % places', v_rows, v_target.nombre_prevu;
    end if;
    if v_inv.nombre_prevu <> v_target.nombre_prevu or v_inv.nombre_arrive <> v_target.nombre_arrive then
      raise exception 'ECHEC 3: la création des lignes a modifié les totaux';
    end if;
    v_report := v_report || '3 ok; ';

    -- 4. Pointer la première personne arrivée.
    select ig.guest_id into v_guest from invitation_guests ig where ig.invitation_id = v_target.id limit 1;
    perform set_guest_arrival_status(p_guest_id => v_guest, p_agent_id => null, p_status => 'arrive');
    select * into v_inv from invitations where id = v_target.id;
    if v_inv.nombre_arrive <> 1 then
      raise exception 'ECHEC 4: compteur = % après une arrivée', v_inv.nombre_arrive;
    end if;
    v_report := v_report || '4 ok; ';
  end if;

  raise exception 'SQL_TESTS_PASSED (tout est annulé) : %', v_report;
end $$;
