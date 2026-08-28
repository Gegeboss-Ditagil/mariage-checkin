-- Synchronise les tags administratifs non-role avec l'import With Joy.
-- Cette migration est conservee dans Git pour refleter l'etat de production;
-- elle ne doit pas etre reappliquee dans le cadre de ce commit.

create or replace function add_invitation_tag(
  p_invitation_id uuid,
  p_tag text,
  p_agent_id uuid
) returns invitations as $$
declare
  v_inv invitations;
  v_tag text := btrim(p_tag);
  v_non_role_tags text[] := array[
    'Côté_Nelly','Côté_Gege','SMS_1506','SMSGEGE_1506','SMS_nelly1606','SMS_1506AA','SMS_Late_Gege',
    '2evague','Maybe','Amis_Gege','notable',
    'Parents Culumbu','Parents Gege','Parents Nelly','Famille Kumpesa Vemba','Famille Mbidi DOS','Parents Nelly / Tonton Mbiki',
    'Groomsman','Bridesmaid',
    'Cortege','Cortège','Need_Contact','Mail'
  ];
  v_is_role_tag boolean;
begin
  if v_tag is null or v_tag = '' then raise exception 'tag_requis'; end if;
  select * into v_inv from invitations where id = p_invitation_id for update;
  if not found then raise exception 'invitation_not_found'; end if;
  if v_tag = any(v_inv.tags) then return v_inv; end if;

  v_is_role_tag := (v_tag !~ '^[TF][0-9]{3}$')
    and not (v_tag = any(v_non_role_tags))
    and lower(v_tag) not in ('needs_table_gege', 'needs_table_nelly');

  update invitations
    set tags = array_append(tags, v_tag),
        cote = case
          when v_tag = 'Côté_Gege' then 'Gege'
          when v_tag = 'Côté_Nelly' then 'Nelly'
          else cote
        end,
        category = case when v_is_role_tag then 'Staff' else category end
    where id = p_invitation_id returning * into v_inv;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
  values (v_inv.event_id, 'invitation_tag_add', p_invitation_id, v_inv.table_id, p_agent_id,
    jsonb_build_object('nom_affichage', v_inv.nom_affichage, 'tag', v_tag));
  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;

create or replace function remove_invitation_tag(
  p_invitation_id uuid,
  p_tag text,
  p_agent_id uuid
) returns invitations as $$
declare
  v_inv invitations;
  v_tag text := btrim(p_tag);
  v_non_role_tags text[] := array[
    'Côté_Nelly','Côté_Gege','SMS_1506','SMSGEGE_1506','SMS_nelly1606','SMS_1506AA','SMS_Late_Gege',
    '2evague','Maybe','Amis_Gege','notable',
    'Parents Culumbu','Parents Gege','Parents Nelly','Famille Kumpesa Vemba','Famille Mbidi DOS','Parents Nelly / Tonton Mbiki',
    'Groomsman','Bridesmaid',
    'Cortege','Cortège','Need_Contact','Mail'
  ];
  v_new_tags text[];
  v_was_role_tag boolean;
  v_still_has_role_tag boolean;
begin
  if v_tag is null or v_tag = '' then raise exception 'tag_requis'; end if;
  select * into v_inv from invitations where id = p_invitation_id for update;
  if not found then raise exception 'invitation_not_found'; end if;
  if not (v_tag = any(v_inv.tags)) then return v_inv; end if;

  v_new_tags := array_remove(v_inv.tags, v_tag);
  v_was_role_tag := (v_tag !~ '^[TF][0-9]{3}$')
    and not (v_tag = any(v_non_role_tags))
    and lower(v_tag) not in ('needs_table_gege', 'needs_table_nelly');
  v_still_has_role_tag := exists (
    select 1 from unnest(v_new_tags) t
    where (t !~ '^[TF][0-9]{3}$')
      and not (t = any(v_non_role_tags))
      and lower(t) not in ('needs_table_gege', 'needs_table_nelly')
  );

  update invitations
    set tags = v_new_tags,
        cote = case
          when v_tag = 'Côté_Gege' and v_inv.cote = 'Gege' then 'Neutre'
          when v_tag = 'Côté_Nelly' and v_inv.cote = 'Nelly' then 'Neutre'
          else cote
        end,
        category = case
          when v_was_role_tag and not v_still_has_role_tag and v_inv.category = 'Staff' then null
          else category
        end
    where id = p_invitation_id returning * into v_inv;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
  values (v_inv.event_id, 'invitation_tag_remove', p_invitation_id, v_inv.table_id, p_agent_id,
    jsonb_build_object('nom_affichage', v_inv.nom_affichage, 'tag', v_tag));
  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;
