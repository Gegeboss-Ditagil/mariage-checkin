-- ============================================================================
-- Reordonnance de la priorite de placement automatique -- retour de Gersom
-- (16/09/2026, apres constat sur une demande "Test" placee automatiquement) :
-- "si la personne est venue avec quelqu'un... on va suggerer en premier :
-- un, on va analyser sa table, et deux, si elle est cote GG ou cote Nelly
-- pour la mettre dans une table qui est pareille, et sinon ensuite
-- l'excedentaire. Et ensuite, s'il y a plein de places dans l'excedentaire,
-- voir s'il y a d'autres places quelque part d'autre."
--
-- auto_assign_table_for_guest_approval (0045/0046) essayait jusqu'ici la
-- table excedentaire (reserve) AVANT de considerer le cote de l'invite --
-- l'ordre voulu est inverse : le cote passe desormais devant la reserve.
-- Nouvel ordre de priorite (seul l'ordre change, chaque etape individuelle
-- est inchangee) :
--   0. La table du groupe avec qui l'invite est arrive (linked_invitation_id),
--      si elle a de la place -- inchange.
--   1. NOUVEAU : la table non-reserve du meme cote que l'invite avec le plus
--      de place libre (cote deduit des invitations deja assises a cette
--      table, comme avant).
--   2. La table excedentaire (reserve), quel que soit le cote -- reprend
--      exactement l'ancienne etape 1, simplement deplacee apres le cote.
--   3. NOUVEAU (etait fusionne avec l'ancienne etape 2) : n'importe quelle
--      autre table non-reserve avec assez de place, cote oppose inclus,
--      en priorisant celle qui a le plus de place libre.
--   4. Aucune place nulle part -- reste approuvee sans table, inchange.
--
-- Purement une CREATE OR REPLACE FUNCTION : aucune donnee existante n'est
-- modifiee, seules les FUTURES approbations sans reservation prealable
-- suivent le nouvel ordre. Retour arriere : reappliquer le corps de fonction
-- de la migration 0046 (conserve ci-dessous en commentaire pour reference
-- rapide sans avoir a fouiller l'historique Git).
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
  v_linked_table_id uuid;
begin
  select * into v_req from guest_approval_requests where id = p_request_id for update;
  if not found then raise exception 'request_not_found'; end if;
  if v_req.statut <> 'approuve' then raise exception 'request_not_approved'; end if;
  if v_req.table_id is not null then raise exception 'request_already_assigned'; end if;

  -- Verrouille toutes les tables de l'evenement : deux approbations
  -- simultanees ne doivent jamais choisir la meme place libre en meme temps.
  perform 1 from tables where event_id = v_req.event_id order by id for update;

  -- Priorite 0 : la table du groupe avec qui la personne est venue, si la
  -- demande y est liee et que cette table a de la place.
  if v_req.linked_invitation_id is not null then
    select i.table_id into v_linked_table_id from invitations i where i.id = v_req.linked_invitation_id;
    if v_linked_table_id is not null then
      select t.id into v_table_id
      from tables t
      where t.id = v_linked_table_id
        and t.capacity - coalesce((
          select sum(case when i.ne_viendra_pas then i.nombre_arrive else greatest(i.nombre_prevu, i.nombre_arrive) end)
          from invitations i where i.table_id = t.id
        ), 0) - coalesce((
          select sum(o.nombre_personnes) from overflow_assignments o where o.reserve_table_id = t.id
        ), 0) >= v_req.nombre_invites;
    end if;
  end if;

  -- Priorite 1 : table non-reserve du meme cote que l'invite, avec assez de
  -- place -- en priorisant celle qui a le plus de place libre.
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
    where candidates.libres >= v_req.nombre_invites and candidates.meme_cote
    order by candidates.libres desc, candidates.number
    limit 1;
  end if;

  -- Priorite 2 : table excedentaire (reserve), quel que soit le cote.
  if v_table_id is null then
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
  end if;

  -- Priorite 3 : sinon, n'importe quelle autre table non-reserve avec assez
  -- de place (cote oppose inclus), en priorisant celle qui a le plus de
  -- place libre.
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
        ), 0) as libres
      from tables t
      where t.event_id = v_req.event_id and not t.is_reserve
    ) candidates
    where candidates.libres >= v_req.nombre_invites
    order by candidates.libres desc, candidates.number
    limit 1;
  end if;

  -- Priorite 4 : aucune place nulle part -- reste approuvee sans table.
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
        'nombre_invites', v_req.nombre_invites, 'table_number', v_table.number, 'auto', true,
        'linked_invitation_id', v_req.linked_invitation_id));
  return v_inv;
end;
$$ language plpgsql security invoker set search_path = public, pg_temp;
