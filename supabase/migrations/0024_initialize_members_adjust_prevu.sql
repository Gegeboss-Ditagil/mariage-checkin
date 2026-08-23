-- ============================================================================
-- Corrige initialize_invitation_members : quand une ligne est retiree du
-- brouillon avant le premier enregistrement, le nombre de personnes prevues
-- doit diminuer pour correspondre au nombre de membres effectivement sauves.
--
-- Exemple reel precise le 23/08/2026 : Famille Bolamba, 2 personnes prevues;
-- Koffi retire du brouillon avant l'enregistrement; le groupe doit devenir
-- complet a 1/1 plutot que rester partiel a 1/2.
--
-- La fonction ne fait jamais grandir nombre_prevu. Ajouter une personne reste
-- le role de add_invitation_member ou d'un nouvel import. L'ecriture est
-- serialisee par SELECT ... FOR UPDATE et journalisee dans audit_logs.
--
-- Deja applique directement en production le 23/08/2026 avec autorisation
-- explicite. Cette migration numerotee apres 0023 documente l'etat reel et
-- rejoue le correctif de facon idempotente avec CREATE OR REPLACE.
-- ============================================================================
create or replace function initialize_invitation_members(
  p_invitation_id uuid,
  p_members jsonb, -- tableau de {"prenom": text|null, "nom": text|null}
  p_agent_id uuid
) returns invitations as $$
declare
  v_inv invitations;
  v_existing int;
  v_member jsonb;
  v_prenom text;
  v_nom text;
  v_affichage text;
  v_guest_id uuid;
  v_member_count int;
  v_new_prevu int;
  v_statut text;
  v_original_prevu int;
  v_was_adjusted boolean;
begin
  select * into v_inv from invitations where id = p_invitation_id for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  select count(*) into v_existing from invitation_guests where invitation_id = p_invitation_id;
  if v_existing > 0 then
    raise exception 'already_initialized';
  end if;

  v_member_count := jsonb_array_length(coalesce(p_members, '[]'::jsonb));
  v_original_prevu := v_inv.nombre_prevu;
  v_was_adjusted := false;

  for v_member in select * from jsonb_array_elements(coalesce(p_members, '[]'::jsonb))
  loop
    v_prenom := nullif(trim(both from coalesce(v_member->>'prenom', '')), '');
    v_nom := nullif(trim(both from coalesce(v_member->>'nom', '')), '');
    v_affichage := nullif(trim(both from (coalesce(v_prenom, '') || ' ' || coalesce(v_nom, ''))), '');

    insert into guests (event_id, nom, prenom, nom_affichage)
      values (v_inv.event_id, v_nom, v_prenom, coalesce(v_affichage, 'Invite sans nom'))
      returning id into v_guest_id;

    insert into invitation_guests (invitation_id, guest_id) values (p_invitation_id, v_guest_id);
  end loop;

  -- Ajuste a la baisse seulement. Une liste egale ou plus longue ne change
  -- pas nombre_prevu afin d'eviter qu'une initialisation serve d'ajout implicite.
  if v_member_count < v_original_prevu then
    v_new_prevu := v_member_count;
    v_was_adjusted := true;

    if v_inv.nombre_arrive = 0 then
      v_statut := 'non_arrive';
    elsif v_inv.nombre_arrive < v_new_prevu then
      v_statut := 'partiel';
    elsif v_inv.nombre_arrive = v_new_prevu then
      v_statut := 'complet';
    else
      v_statut := 'excedent';
    end if;

    update invitations set nombre_prevu = v_new_prevu, statut = v_statut
      where id = p_invitation_id
      returning * into v_inv;
  end if;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (
      v_inv.event_id, 'members_initialize', p_invitation_id, v_inv.table_id, p_agent_id,
      jsonb_build_object(
        'nom_affichage', v_inv.nom_affichage,
        'nombre_membres', v_member_count,
        'nombre_prevu_avant', v_original_prevu,
        'nombre_prevu_apres', v_inv.nombre_prevu,
        'nombre_prevu_ajuste', v_was_adjusted
      )
    );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;

