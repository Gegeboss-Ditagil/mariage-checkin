-- ============================================================================
-- Placement automatique a l'approbation -- retour de Gersom le 02/09/2026 :
-- "je n'ai pas besoin de voir reserver une table directement quand je vais
-- sur la page approbation... etre capable de approuver ou refuser
-- rapidement (...) a la base, dans la portion pour la table, on mettra
-- directement table excedentaire (...) si la table excedentaire est pleine,
-- ca va proposer ensuite la table ou il y a le plus de disponibilite dans
-- le cote de la personne (...) et s'il n'y a plus de place, l'autre cote."
--
-- Remplace le besoin d'un choix manuel de table a l'approbation (la
-- reservation pre-approbation de 0044 reste disponible comme mecanisme sous-
-- jacent mais n'est plus le parcours principal) : quand une demande est
-- approuvee sans reservation deja posee, ce RPC choisit et assigne la table
-- lui-meme, atomiquement, dans le meme ordre de priorite que demande :
--   1. La table de reserve (table excedentaire / Table 41), si elle a de la
--      place -- quel que soit le cote de l'invite. Le directeur de festin
--      peut ensuite deplacer la personne lui-meme s'il le souhaite.
--   2. Sinon, la table avec le plus de place libre, en priorisant le cote de
--      l'invite (cote deduit des invitations deja assises a cette table --
--      en pratique chaque table est dediee a un seul cote), puis n'importe
--      quel cote si aucune place n'est disponible du bon cote.
--   3. Si aucune table n'a de place nulle part, la demande reste approuvee
--      sans table -- jamais de double booking silencieux, un placeur ou
--      directeur reprend la main manuellement depuis /approbations (comme
--      avant l'existence de cette fonction).
-- ============================================================================

create or replace function auto_assign_table_for_guest_approval(
  p_request_id uuid,
  p_agent_id uuid
) returns invitations as $$
declare
  v_req guest_approval_requests;
  v_table tables;
  v_inv invitations;
  v_table_id uuid;
begin
  select * into v_req from guest_approval_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.statut <> 'approuve' then raise exception 'request_not_approved'; end if;
  if v_req.table_id is not null then raise exception 'request_already_assigned'; end if;

  -- Verrouille toutes les tables de l'evenement : deux approbations
  -- simultanees ne doivent jamais choisir la meme place libre en meme temps.
  perform 1 from tables where event_id = v_req.event_id order by id for update;

  -- Priorite 1 : table excedentaire (reserve), quel que soit le cote.
  select t.id into v_table_id
  from tables t
  where t.event_id = v_req.event_id and t.is_reserve
    and t.capacity - coalesce((
      select sum(case when i.ne_viendra_pas then i.nombre_arrive else greatest(i.nombre_prevu, i.nombre_arrive) end)
      from invitations i where i.table_id = t.id
    ), 0) - coalesce((
      select sum(o.nombre_personnes) from overflow_assignments o where o.reserve_table_id = t.id
    ), 0) >= v_req.nombre_invites
  order by t.number
  limit 1;

  -- Priorite 2 : sinon, la table avec le plus de place libre -- meme cote
  -- d'abord, puis l'autre cote si aucune place n'y est disponible.
  if v_table_id is null then
    select candidates.id into v_table_id
    from (
      select
        t.id,
        t.number,
        t.capacity - coalesce((
          select sum(case when i.ne_viendra_pas then i.nombre_arrive else greatest(i.nombre_prevu, i.nombre_arrive) end)
          from invitations i where i.table_id = t.id
        ), 0) - coalesce((
          select sum(o.nombre_personnes) from overflow_assignments o where o.reserve_table_id = t.id
        ), 0) as libres,
        coalesce((
          select count(*) filter (where i.cote = v_req.cote) > count(*) filter (where i.cote <> v_req.cote)
          from invitations i where i.table_id = t.id
        ), false) as meme_cote
      from tables t
      where t.event_id = v_req.event_id and not t.is_reserve
    ) candidates
    where candidates.libres >= v_req.nombre_invites
    order by candidates.meme_cote desc, candidates.libres desc, candidates.number
    limit 1;
  end if;

  -- Priorite 3 : aucune place nulle part -- reste approuvee sans table.
  if v_table_id is null then
    return null;
  end if;

  select * into v_table from tables where id = v_table_id for update;

  insert into invitations (
    event_id, table_id, nom_affichage, nombre_prevu, nombre_arrive, statut, cote, notes, placement_status
  ) values (
    v_req.event_id, v_table_id, v_req.nom_invite, v_req.nombre_invites, 0, 'non_arrive', v_req.cote,
    'Invité surprise approuvé (placement automatique)', 'confirmee'
  ) returning * into v_inv;

  update guest_approval_requests set table_id = v_table_id, assigned_by = p_agent_id, assigned_at = now()
    where id = p_request_id;
  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (v_req.event_id, 'guest_approval_assigned', v_inv.id, v_table_id, p_agent_id,
      jsonb_build_object('request_id', p_request_id, 'nom_invite', v_req.nom_invite,
        'nombre_invites', v_req.nombre_invites, 'table_number', v_table.number, 'auto', true));
  return v_inv;
end;
$$ language plpgsql security invoker set search_path = public, pg_temp;
