-- ============================================================================
-- Permet de reserver une table pour une demande REFUSEE, en vue de la
-- reconsiderer -- demande de Gersom le 13/09/2026 : "si je reconsidere
-- quelqu'un et je fais approuver, je n'avais pas l'option de le mettre sur
-- une table... le process a ete automatique". Jusqu'ici, reconsiderer un
-- refus (v1.43.0, allowReconsiderFromRefused) approuvait directement et
-- laissait le placement automatique (auto_assign_table_for_guest_approval,
-- 0045) choisir la table, sans que l'agent puisse la determiner d'abord.
--
-- reserve_table_for_guest_approval (0044) exigeait jusqu'ici
-- statut = 'en_attente' ; elle accepte desormais aussi 'refuse', avec la
-- meme logique de capacite (voir lib/guestApprovalDecide.ts : la reservation
-- est finalisee en vraie assignation des que la demande est approuvee, quel
-- que soit le statut de depart). Une demande refusee n'a jamais de
-- reserved_table_id deja pose (liberee automatiquement au refus, voir
-- finalizeDecision) -- aucun risque de collision avec une reservation
-- laissee par erreur.
-- ============================================================================

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
  if v_req.statut not in ('en_attente', 'refuse') then raise exception 'request_not_pending'; end if;
  if v_req.table_id is not null then raise exception 'request_already_assigned'; end if;

  select * into v_table from tables where id = p_table_id for update;
  if not found or v_table.event_id <> v_req.event_id then raise exception 'table_not_found'; end if;

  select coalesce(sum(case when ne_viendra_pas then nombre_arrive else greatest(nombre_prevu, nombre_arrive) end), 0)
    into v_occupancy from invitations where table_id = p_table_id;
  select v_occupancy + coalesce(sum(nombre_personnes), 0)
    into v_occupancy from overflow_assignments where reserve_table_id = p_table_id;
  -- Autres demandes encore en attente OU refusees-mais-reservees (le meme
  -- parcours de reconsideration, jamais celle-ci) deja reservees sur cette
  -- meme table : comptees pour qu'aucune deux demandes ne se reservent les
  -- memes places.
  select v_occupancy + coalesce(sum(nombre_invites), 0)
    into v_occupancy from guest_approval_requests
    where reserved_table_id = p_table_id and statut in ('en_attente', 'refuse') and id <> p_request_id;

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
