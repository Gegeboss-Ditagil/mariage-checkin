-- ============================================================================
-- Reservation de table AVANT approbation -- demande de Gersom le 02/09/2026 :
-- "je veux pouvoir cliquer tout de suite, voir les tables disponibles, la
-- mettre sur une table pour ne pas qu'on fasse du double booking" pendant
-- qu'une demande d'invite surprise est encore en_attente.
--
-- Ne cree AUCUNE invitation tant que la demande n'est pas approuvee -- juste
-- une intention (reserved_table_id) qui compte dans le calcul de capacite le
-- temps que la demande reste en_attente, pour qu'une autre reservation ne
-- puisse pas prendre les memes places. A l'approbation, la reservation est
-- automatiquement finalisee en vraie assignation (assign_table_to_guest_
-- approval_strict, 0038) par le code applicatif (lib/guestApprovalDecide.ts).
-- Au refus, elle est simplement liberee -- aucune invitation n'a jamais
-- existe, rien a annuler cote invitations/tables.
-- ============================================================================

alter table guest_approval_requests add column if not exists reserved_table_id uuid references tables(id);

create or replace function reserve_table_for_guest_approval(
  p_request_id uuid,
  p_table_id uuid,
  p_agent_id uuid
) returns guest_approval_requests as $$
declare
  v_req guest_approval_requests;
  v_table tables;
  v_occupancy int;
begin
  select * into v_req from guest_approval_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.statut <> 'en_attente' then raise exception 'request_not_pending'; end if;
  if v_req.table_id is not null then raise exception 'request_already_assigned'; end if;

  select * into v_table from tables where id = p_table_id for update;
  if not found or v_table.event_id <> v_req.event_id then raise exception 'table_not_found'; end if;

  select coalesce(sum(case when ne_viendra_pas then nombre_arrive else greatest(nombre_prevu, nombre_arrive) end), 0)
    into v_occupancy from invitations where table_id = p_table_id;
  select v_occupancy + coalesce(sum(nombre_personnes), 0)
    into v_occupancy from overflow_assignments where reserve_table_id = p_table_id;
  -- Autres demandes encore en attente deja reservees sur cette meme table
  -- (jamais celle-ci) : comptees pour qu'aucune deux demandes en attente ne
  -- puissent se reserver les memes places.
  select v_occupancy + coalesce(sum(nombre_invites), 0)
    into v_occupancy from guest_approval_requests
    where reserved_table_id = p_table_id and statut = 'en_attente' and id <> p_request_id;

  if v_occupancy + v_req.nombre_invites > v_table.capacity then
    raise exception 'target_capacity_exceeded';
  end if;

  update guest_approval_requests set reserved_table_id = p_table_id where id = p_request_id returning * into v_req;
  insert into audit_logs (event_id, action, table_id, agent_id, details)
    values (v_req.event_id, 'guest_approval_reserved', p_table_id, p_agent_id,
      jsonb_build_object('request_id', p_request_id, 'nom_invite', v_req.nom_invite,
        'nombre_invites', v_req.nombre_invites, 'table_number', v_table.number));
  return v_req;
end;
$$ language plpgsql security invoker set search_path = public, pg_temp;

-- Annule une reservation en attente (l'agent change d'avis, ou nettoyage
-- automatique quand la demande est refusee -- voir lib/guestApprovalDecide.ts).
create or replace function release_guest_approval_reservation(
  p_request_id uuid,
  p_agent_id uuid
) returns guest_approval_requests as $$
declare
  v_req guest_approval_requests;
begin
  select * into v_req from guest_approval_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.reserved_table_id is null then return v_req; end if;
  update guest_approval_requests set reserved_table_id = null where id = p_request_id returning * into v_req;
  insert into audit_logs (event_id, action, agent_id, details)
    values (v_req.event_id, 'guest_approval_reservation_released', p_agent_id,
      jsonb_build_object('request_id', p_request_id, 'nom_invite', v_req.nom_invite));
  return v_req;
end;
$$ language plpgsql security invoker set search_path = public, pg_temp;
