-- ============================================================================
-- move_invitations_table : variante en lot de move_invitation_table
-- (0008_move_invitation.sql). Deplace plusieurs invitations vers UNE meme
-- table cible en une seule transaction, avec un journal d'audit par
-- invitation (meme action 'invitation_move', donc /history les affiche sans
-- traitement special).
--
-- Contrairement a move_invitation_table, elle ne leve PAS d'exception si une
-- invitation du lot a disparu entre-temps ou est deja sur la table cible :
-- elle l'ignore et continue avec le reste du lot. Bloquer tout un lot de
-- reorganisation de table parce qu'une seule ligne posait probleme serait
-- plus genant qu'utile -- le placement pendant l'evenement est justement fait
-- pour etre rapide et souvent provisoire (voir docs/QE_QA_PROCESS.md).
--
-- swap_invitations_between_tables : echange entre deux tables. Deplace un
-- groupe de A vers B et un autre groupe de B vers A, dans la meme
-- transaction (elle appelle move_invitations_table deux fois ; comme c'est
-- un appel plpgsql direct, pas une nouvelle connexion, tout reste dans la
-- transaction de l'appelant). Les deux groupes peuvent avoir des tailles
-- differentes (ex: 2 personnes contre 4) : ce n'est pas un echange 1 pour 1,
-- juste deux mouvements groupes executes ensemble.
-- ============================================================================

create or replace function move_invitations_table(
  p_invitation_ids uuid[],
  p_new_table_id uuid,
  p_agent_id uuid
) returns setof invitations as $$
declare
  v_id uuid;
  v_inv invitations;
  v_ancienne_table uuid;
  v_target_event_id uuid;
begin
  select event_id into v_target_event_id from tables where id = p_new_table_id;
  if not found then
    raise exception 'table_not_found';
  end if;

  foreach v_id in array p_invitation_ids loop
    select * into v_inv from invitations where id = v_id for update;

    if not found then
      continue; -- invitation disparue entre-temps : on l'ignore, pas d'echec du lot
    end if;

    -- Même garantie que move_invitation_table (0008) : une invitation ne
    -- peut jamais être déplacée vers la table d'un autre événement.
    if v_inv.event_id <> v_target_event_id then
      raise exception 'table_not_found';
    end if;

    if v_inv.table_id = p_new_table_id then
      continue; -- deja sur la table cible
    end if;

    v_ancienne_table := v_inv.table_id;

    update invitations
      set table_id = p_new_table_id
      where id = v_id
      returning * into v_inv;

    insert into audit_logs (
      event_id, action, invitation_id, table_id, agent_id,
      origin_table_id, reserve_table_id, details
    ) values (
      v_inv.event_id, 'invitation_move', v_id, p_new_table_id, p_agent_id,
      v_ancienne_table, p_new_table_id,
      jsonb_build_object('nom_affichage', v_inv.nom_affichage, 'ancienne_table_id', v_ancienne_table, 'lot', true)
    );

    return next v_inv;
  end loop;

  return;
end;
$$ language plpgsql set search_path = public, pg_temp;

create or replace function swap_invitations_between_tables(
  p_ids_out_of_a uuid[],
  p_table_a uuid,
  p_ids_out_of_b uuid[],
  p_table_b uuid,
  p_agent_id uuid
) returns void as $$
begin
  if p_table_a = p_table_b then
    raise exception 'same_table';
  end if;

  if p_ids_out_of_a && p_ids_out_of_b then
    raise exception 'overlapping_selections';
  end if;

  if not exists (
    select 1
    from tables a
    join tables b on b.id = p_table_b and b.event_id = a.event_id
    where a.id = p_table_a
  ) then
    raise exception 'table_not_found';
  end if;

  -- Les identifiants reçus viennent du sessionStorage du navigateur : la
  -- base revérifie leur table source pour empêcher un appel API altéré de
  -- déplacer silencieusement des invitations provenant d'une troisième table.
  if exists (
    select 1 from unnest(p_ids_out_of_a) id
    left join invitations i on i.id = id
    where i.id is null or i.table_id is distinct from p_table_a
  ) then
    raise exception 'invalid_source_table_a';
  end if;

  if exists (
    select 1 from unnest(p_ids_out_of_b) id
    left join invitations i on i.id = id
    where i.id is null or i.table_id is distinct from p_table_b
  ) then
    raise exception 'invalid_source_table_b';
  end if;

  perform * from move_invitations_table(p_ids_out_of_a, p_table_b, p_agent_id);
  perform * from move_invitations_table(p_ids_out_of_b, p_table_a, p_agent_id);
end;
$$ language plpgsql set search_path = public, pg_temp;
