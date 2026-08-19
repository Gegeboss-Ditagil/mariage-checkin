-- ============================================================================
-- Permet de marquer explicitement une invitation comme "ne viendra pas",
-- pour liberer ses places prevues du calcul de capacite SANS attendre que
-- tout le monde soit arrive et sans se fier a une simple estimation.
--
-- Pourquoi : le calcul de capacite des tables se basait jusqu'ici sur
-- nombre_prevu, qui reste fige tel qu'annonce avant l'evenement. Une table
-- pouvait donc afficher "complet" toute la soiree alors que certains invites
-- prevus ne se presenteront jamais. Ce correctif ajoute un moyen simple et
-- trace (via audit_logs) de retirer explicitement ces places du calcul, des
-- que le personnel a la certitude que le groupe ne viendra pas (appel
-- telephonique, message, ou simplement l'heure tres avancee de la soiree).
-- ============================================================================

alter table invitations
  add column if not exists ne_viendra_pas boolean not null default false;

-- Si un groupe marque "ne viendra pas" se presente quand meme, le prochain
-- checkin doit automatiquement lever le marqueur (sinon ses places
-- resteraient a tort comptees comme liberees alors que les gens sont la).
create or replace function record_checkin(
  p_invitation_id uuid,
  p_agent_id uuid,
  p_nombre_personnes int,
  p_is_correction boolean default false,
  p_absolute_total int default null
) returns invitations as $$
declare
  v_inv invitations;
  v_ancien int;
  v_nouveau int;
  v_statut text;
begin
  select * into v_inv from invitations where id = p_invitation_id for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  v_ancien := v_inv.nombre_arrive;

  if p_absolute_total is not null then
    v_nouveau := p_absolute_total;
  else
    v_nouveau := v_ancien + p_nombre_personnes;
  end if;

  if v_nouveau < 0 then
    raise exception 'negative_total_not_allowed';
  end if;

  if v_nouveau = 0 then
    v_statut := 'non_arrive';
  elsif v_nouveau < v_inv.nombre_prevu then
    v_statut := 'partiel';
  elsif v_nouveau = v_inv.nombre_prevu then
    v_statut := 'complet';
  else
    v_statut := 'excedent';
  end if;

  update invitations
    set nombre_arrive = v_nouveau,
        statut = v_statut,
        ne_viendra_pas = case when v_nouveau > 0 then false else ne_viendra_pas end
    where id = p_invitation_id
    returning * into v_inv;

  insert into checkins (
    event_id, invitation_id, agent_id, nombre_personnes,
    ancien_total, nouveau_total, is_correction
  ) values (
    v_inv.event_id, p_invitation_id, p_agent_id,
    greatest(abs(v_nouveau - v_ancien), 1),
    v_ancien, v_nouveau, p_is_correction
  );

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id,
    nombre_personnes, ancien_total, nouveau_total, details
  ) values (
    v_inv.event_id,
    case when p_is_correction then 'correction' else 'checkin' end,
    p_invitation_id, v_inv.table_id, p_agent_id,
    v_nouveau - v_ancien, v_ancien, v_nouveau,
    jsonb_build_object('nom_affichage', v_inv.nom_affichage)
  );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;

-- ----------------------------------------------------------------------------
-- set_invitation_no_show : marque ou demarque une invitation comme "ne
-- viendra pas". Trace dans audit_logs (qui, quand). Ne touche jamais
-- nombre_arrive/nombre_prevu/statut -- uniquement le marqueur, qui est
-- ensuite pris en compte partout ou la capacite des tables est calculee.
-- ----------------------------------------------------------------------------
create or replace function set_invitation_no_show(
  p_invitation_id uuid,
  p_agent_id uuid,
  p_no_show boolean
) returns invitations as $$
declare
  v_inv invitations;
begin
  select * into v_inv from invitations where id = p_invitation_id for update;

  if not found then
    raise exception 'invitation_not_found';
  end if;

  update invitations
    set ne_viendra_pas = p_no_show
    where id = p_invitation_id
    returning * into v_inv;

  insert into audit_logs (
    event_id, action, invitation_id, table_id, agent_id, details
  ) values (
    v_inv.event_id,
    case when p_no_show then 'mark_no_show' else 'unmark_no_show' end,
    p_invitation_id, v_inv.table_id, p_agent_id,
    jsonb_build_object('nom_affichage', v_inv.nom_affichage, 'nombre_prevu', v_inv.nombre_prevu)
  );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;

