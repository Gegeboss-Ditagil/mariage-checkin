-- ============================================================================
-- add_invitation_tag / remove_invitation_tag : gerer les etiquettes d'une
-- invitation directement depuis l'application (fiche /checkin/[invitationId]),
-- sans repasser par un reimport CSV With Joy. Objectif (demande explicite du
-- 22/08/2026) : pouvoir marquer rapidement quelqu'un de trouve sur place
-- (photographe, prestataire, animation/DJ...) comme faisant partie du staff,
-- lui donner un cote (Gege/Nelly), ou le marquer "sans table" (notable) --
-- sans attendre le prochain import.
--
-- Ces deux fonctions repliquent EXACTEMENT la meme heuristique que
-- scripts/build_plan_from_csv.py (NON_ROLE_TAGS / is_role_tag / is_staff_member)
-- pour qu'une etiquette ajoutee ou retiree a la main produise le meme resultat
-- qu'un reimport avec le meme tag. Si NON_ROLE_TAGS change cote Python, la
-- reporter ici aussi -- sinon un tag "role" pourrait etre traite differemment
-- selon qu'il vient d'un import ou d'une modification manuelle.
--
-- Effets de bord automatiques a l'ajout/retrait d'un tag connu :
--   - 'Côté_Gege' / 'Côté_Nelly'            -> synchronise la colonne `cote`
--   - tout tag de "role" (ex: SERVICES, Photographe, Prestataire,
--     DJ_Animation -- tout ce qui n'est ni un tag de table Txxx/Fxxx ni un
--     tag "non-role" connu) -> category = 'Staff' a l'ajout ; a category =
--     null au retrait SEULEMENT si c'etait le dernier tag de role restant
--     (ne desindividualise jamais silencieusement un staff qui garde un
--     autre tag de role).
--   - 'notable' n'a aucun effet automatique sur category/cote : il sert
--     uniquement a afficher "Sans table" sur /staff (docs/BUSINESS_RULES.md).
--
-- Capacite requise cote application : manageMembers (meme perimetre que
-- rename_invitation, y compris agent_checkin) -- voir lib/permissions.ts et
-- app/api/invitations/tags/{add,remove}/route.ts.
-- ============================================================================

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
    'Groomsman','Bridesmaid'
  ];
  v_is_role_tag boolean;
begin
  if v_tag is null or v_tag = '' then
    raise exception 'tag_requis';
  end if;

  select * into v_inv from invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'invitation_not_found';
  end if;

  -- Deja present : idempotent, on ne touche a rien (pas de doublon dans le
  -- tableau, pas de ligne d'audit pour un non-evenement).
  if v_tag = any(v_inv.tags) then
    return v_inv;
  end if;

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
        category = case
          when v_is_role_tag then 'Staff'
          else category
        end
    where id = p_invitation_id
    returning * into v_inv;

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id, details
  ) values (
    v_inv.event_id, 'invitation_tag_add', p_invitation_id, v_inv.table_id, p_agent_id,
    jsonb_build_object('nom_affichage', v_inv.nom_affichage, 'tag', v_tag)
  );

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
    'Groomsman','Bridesmaid'
  ];
  v_new_tags text[];
  v_was_role_tag boolean;
  v_still_has_role_tag boolean;
begin
  if v_tag is null or v_tag = '' then
    raise exception 'tag_requis';
  end if;

  select * into v_inv from invitations where id = p_invitation_id for update;
  if not found then
    raise exception 'invitation_not_found';
  end if;

  -- Absent : idempotent, rien a faire.
  if not (v_tag = any(v_inv.tags)) then
    return v_inv;
  end if;

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
        -- Ne repasse category a null que si CE retrait fait perdre le
        -- DERNIER tag de role restant, et seulement si l'invitation etait
        -- Staff a cause des tags (jamais si Staff pour une autre raison).
        category = case
          when v_was_role_tag and not v_still_has_role_tag and v_inv.category = 'Staff' then null
          else category
        end
    where id = p_invitation_id
    returning * into v_inv;

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id, details
  ) values (
    v_inv.event_id, 'invitation_tag_remove', p_invitation_id, v_inv.table_id, p_agent_id,
    jsonb_build_object('nom_affichage', v_inv.nom_affichage, 'tag', v_tag)
  );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;
