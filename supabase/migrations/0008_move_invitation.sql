-- ============================================================================
-- move_invitation_table : deplace une invitation (famille/groupe entier) vers
-- une autre table. Utilise quand des tables sont reorganisees avant/pendant
-- l'evenement (affinites entre familles, no-shows qui liberent des places).
--
-- Volontairement PAS de blocage strict sur la capacite (contrairement aux
-- tables de reserve/overflow) : une table normale peut avoir une chaise en
-- plus au besoin, et bloquer un deplacement en plein evenement serait plus
-- genant qu'utile. Le nombre de places restantes est affiche cote UI pour
-- que la personne qui deplace fasse un choix eclaire.
-- ============================================================================

create or replace function move_invitation_table(
  p_invitation_id uuid,
  p_new_table_id uuid,
  p_agent_id uuid
) returns invitations as $$
declare
  v_inv invitations;
  v_ancienne_table uuid;
begin
  select * into v_inv from invitations where id = p_invitation_id for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  -- Verifie que la nouvelle table existe bien dans le meme evenement.
  if not exists (
    select 1 from tables where id = p_new_table_id and event_id = v_inv.event_id
  ) then
    raise exception 'table_not_found';
  end if;

  if v_inv.table_id = p_new_table_id then
    raise exception 'same_table';
  end if;

  v_ancienne_table := v_inv.table_id;

  update invitations
    set table_id = p_new_table_id
    where id = p_invitation_id
    returning * into v_inv;

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id,
    origin_table_id, reserve_table_id, details
  ) values (
    v_inv.event_id, 'invitation_move', p_invitation_id, p_new_table_id, p_agent_id,
    v_ancienne_table, p_new_table_id,
    jsonb_build_object('nom_affichage', v_inv.nom_affichage, 'ancienne_table_id', v_ancienne_table)
  );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;
