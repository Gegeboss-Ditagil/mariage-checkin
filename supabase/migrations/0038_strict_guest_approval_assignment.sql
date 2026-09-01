-- v1.29.1 — Assignation atomique d'un invité surprise avec réorganisation.
-- La base reste l'autorité : aucune table ne peut dépasser sa capacité et
-- une invitation déjà arrivée/assise ne peut jamais être déplacée.

create or replace function assign_table_to_guest_approval_strict(
  p_request_id uuid,
  p_table_id uuid,
  p_agent_id uuid,
  p_relocations jsonb default '[]'::jsonb
) returns invitations as $$
declare
  v_req guest_approval_requests;
  v_table tables;
  v_inv invitations;
  v_move invitations;
  v_destination tables;
  v_item jsonb;
  v_target_occupancy int;
  v_destination_occupancy int;
  v_moved_from_target int := 0;
begin
  if jsonb_typeof(coalesce(p_relocations, '[]'::jsonb)) <> 'array' then
    raise exception 'relocations_invalid';
  end if;

  select * into v_req from guest_approval_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.statut <> 'approuve' then raise exception 'request_not_approved'; end if;
  if v_req.table_id is not null then raise exception 'request_already_assigned'; end if;

  select * into v_table from tables where id = p_table_id for update;
  if not found or v_table.event_id <> v_req.event_id then raise exception 'table_not_found'; end if;

  -- Verrouillage déterministe de toutes les invitations déplacées. Les doublons
  -- sont refusés pour empêcher de compter deux fois les mêmes places libérées.
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_relocations, '[]'::jsonb)) e
    group by e->>'invitation_id' having count(*) > 1
  ) then raise exception 'relocation_duplicate'; end if;
  perform 1 from invitations
    where id in (select (e->>'invitation_id')::uuid from jsonb_array_elements(coalesce(p_relocations, '[]'::jsonb)) e)
    order by id for update;

  for v_item in select * from jsonb_array_elements(coalesce(p_relocations, '[]'::jsonb)) loop
    select * into v_move from invitations where id = (v_item->>'invitation_id')::uuid;
    if not found or v_move.event_id <> v_req.event_id or v_move.table_id <> p_table_id then
      raise exception 'relocation_not_on_target';
    end if;
    if v_move.nombre_arrive > 0 then raise exception 'arrived_guest_cannot_move'; end if;
    if nullif(v_item->>'destination_table_id', '') is null then raise exception 'destination_required'; end if;
    if (v_item->>'destination_table_id')::uuid = p_table_id then raise exception 'destination_same_as_target'; end if;
    v_moved_from_target := v_moved_from_target + greatest(v_move.nombre_prevu, v_move.nombre_arrive);
  end loop;

  if (select count(distinct e->>'destination_table_id') from jsonb_array_elements(coalesce(p_relocations, '[]'::jsonb)) e)
     <> (select count(*) from tables t where t.id in (
       select distinct (e->>'destination_table_id')::uuid from jsonb_array_elements(coalesce(p_relocations, '[]'::jsonb)) e
     ) and t.event_id = v_req.event_id) then
    raise exception 'destination_not_found';
  end if;

  select coalesce(sum(case when ne_viendra_pas then nombre_arrive else greatest(nombre_prevu, nombre_arrive) end), 0)
    into v_target_occupancy from invitations where table_id = p_table_id;
  select v_target_occupancy + coalesce(sum(nombre_personnes), 0)
    into v_target_occupancy from overflow_assignments where reserve_table_id = p_table_id;
  if v_target_occupancy - v_moved_from_target + v_req.nombre_invites > v_table.capacity then
    raise exception 'target_capacity_exceeded';
  end if;

  -- Chaque destination est vérifiée après regroupement de tous ses mouvements.
  for v_destination in
    select t.* from tables t
    where t.id in (select distinct (e->>'destination_table_id')::uuid from jsonb_array_elements(coalesce(p_relocations, '[]'::jsonb)) e)
    order by t.id for update
  loop
    if v_destination.event_id <> v_req.event_id then raise exception 'destination_not_found'; end if;
    select coalesce(sum(case when ne_viendra_pas then nombre_arrive else greatest(nombre_prevu, nombre_arrive) end), 0)
      into v_destination_occupancy from invitations where table_id = v_destination.id;
    select v_destination_occupancy + coalesce(sum(nombre_personnes), 0)
      into v_destination_occupancy from overflow_assignments where reserve_table_id = v_destination.id;
    select v_destination_occupancy + coalesce(sum(greatest(i.nombre_prevu, i.nombre_arrive)), 0)
      into v_destination_occupancy
      from jsonb_array_elements(coalesce(p_relocations, '[]'::jsonb)) e
      join invitations i on i.id = (e->>'invitation_id')::uuid
      where (e->>'destination_table_id')::uuid = v_destination.id;
    if v_destination_occupancy > v_destination.capacity then raise exception 'destination_capacity_exceeded'; end if;
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_relocations, '[]'::jsonb)) loop
    update invitations set table_id = (v_item->>'destination_table_id')::uuid, updated_at = now()
      where id = (v_item->>'invitation_id')::uuid returning * into v_move;
    insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, origin_table_id, details)
      values (v_req.event_id, 'guest_approval_capacity_relocation', v_move.id,
        (v_item->>'destination_table_id')::uuid, p_agent_id, p_table_id,
        jsonb_build_object('request_id', p_request_id, 'nom_affichage', v_move.nom_affichage));
  end loop;

  insert into invitations (
    event_id, table_id, nom_affichage, nombre_prevu, nombre_arrive, statut, cote, notes, placement_status
  ) values (
    v_req.event_id, p_table_id, v_req.nom_invite, v_req.nombre_invites, 0, 'non_arrive', v_req.cote,
    'Invité surprise approuvé', 'confirmee'
  ) returning * into v_inv;

  update guest_approval_requests set table_id = p_table_id, assigned_by = p_agent_id, assigned_at = now()
    where id = p_request_id;
  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (v_req.event_id, 'guest_approval_assigned', v_inv.id, p_table_id, p_agent_id,
      jsonb_build_object('request_id', p_request_id, 'nom_invite', v_req.nom_invite,
        'nombre_invites', v_req.nombre_invites, 'table_number', v_table.number,
        'relocations', coalesce(p_relocations, '[]'::jsonb)));
  return v_inv;
end;
$$ language plpgsql security invoker set search_path = public, pg_temp;
