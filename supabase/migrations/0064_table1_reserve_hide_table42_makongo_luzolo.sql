-- ============================================================================
-- v1.71.0 (07/10/2026) -- nouvel export seatplan.io (« seating-chart ... (7).pdf »)
-- + guest-list (63).csv, demandes explicites de Gersom :
--   « la table 42 n'existe plus, appeler table 1 Maquela do Zombo la table
--   excédentaire maintenant -- 42 est supprimé et table 1 reste mais elle est
--   vide pour l'excédentaire » ; « Roger Makongo a été ajouté [...] et Luzolo
--   déplacé à la table 31 ».
-- Décisions confirmées par Gersom avant toute écriture (questions posées) :
--   * Steven Kimbau : retiré de la table 31 (suivre le PDF, qui ne l'assoit
--     nulle part ; le CSV le gardait à T031, ce qui mettait la table à 11/10).
--   * Table 42 : DÉSACTIVÉE et masquée dans l'application (capacité 0), pas
--     supprimée -- 13 lignes d'audit_logs (septembre, période de test) la
--     référencent encore (même raisonnement que 0061).
--
-- Nouvelle structure : 41 lignes de tables = 40 tables normales (2-41)
-- + 1 réserve (table 1 « Maquela do Zombo », vide) ; la table 42 reste en
-- base à capacité 0, invisible dans l'app. Capacité officielle 40 x 10 = 400,
-- capacité absolue avec la réserve = 410.
--
-- Sauvegarde : un instantané de toutes les lignes touchées est écrit dans
-- import_backups (RLS, service_role uniquement) AVANT les modifications.
-- Retour arrière : relire cet instantané (snapshot->>'kind' =
-- 'v1.71.0_table1_reserve') et réappliquer les valeurs « before ».
-- Idempotente : peut être rejouée sans effet si déjà appliquée.
-- ============================================================================

do $$
declare
  v_event uuid;
  v_t1 uuid;
  v_t30 uuid;
  v_t31 uuid;
  v_t42 uuid;
begin
  select event_id into v_event from tables where number = 1 limit 1;
  select id into v_t1 from tables where event_id = v_event and number = 1;
  select id into v_t30 from tables where event_id = v_event and number = 30;
  select id into v_t31 from tables where event_id = v_event and number = 31;
  select id into v_t42 from tables where event_id = v_event and number = 42;

  -- 0) Sauvegarde (une seule fois).
  if not exists (select 1 from import_backups where snapshot->>'kind' = 'v1.71.0_table1_reserve') then
    insert into import_backups (event_id, agent_id, snapshot, invitations_count)
    select v_event, null, jsonb_build_object(
      'kind', 'v1.71.0_table1_reserve',
      'tables', (select jsonb_agg(to_jsonb(t)) from tables t where t.id in (v_t1, v_t42)),
      'invitations', (select jsonb_agg(to_jsonb(i)) from invitations i
                      where i.event_id = v_event
                        and (i.nom_affichage in ('Luzolo Patrick Menga', 'Famille Kimbau')
                             or i.nom_affichage = 'Roger Makongo'))
    ), (select count(*) from invitations where event_id = v_event);
  end if;

  -- 1) Table 1 « Maquela do Zombo » devient l'unique réserve (libellé gardé).
  update tables set is_reserve = true
  where id = v_t1 and is_reserve = false;

  -- 2) Table 42 désactivée : plus une réserve, capacité 0, masquée par l'app.
  update tables
  set is_reserve = false, capacity = 0, label = 'Supprimee (historique audit uniquement)'
  where id = v_t42
    and (is_reserve or capacity <> 0 or label is distinct from 'Supprimee (historique audit uniquement)');

  -- 3) Luzolo Patrick Menga : table 36 -> table 31, tag T041 -> T031.
  update invitations
  set table_id = v_t31,
      tags = array_append(array_remove(array_remove(tags, 'T041'), 'T036'), 'T031'),
      placement_status = 'confirmee'
  where event_id = v_event and nom_affichage = 'Luzolo Patrick Menga'
    and (table_id is distinct from v_t31 or not ('T031' = any(tags)));

  -- 4) Famille Kimbau : Steven retiré (4 -> 3), comme sur le PDF.
  update invitations
  set nombre_prevu = 3,
      notes = replace(notes, 'Steven Kimbau, ', '')
  where event_id = v_event and nom_affichage = 'Famille Kimbau'
    and nombre_prevu = 4 and notes like '%Steven Kimbau, %';

  -- 5) Roger Makongo ajouté table 30 (CSV : T030, Côté_Gege, confirmé).
  if not exists (select 1 from invitations where event_id = v_event and nom_affichage = 'Roger Makongo') then
    insert into invitations (event_id, table_id, nom_affichage, nombre_prevu, telephone,
                             notes, tags, cote, placement_status)
    values (v_event, v_t30, 'Roger Makongo', 1, '+33745986455',
            'RSVP: Oui, embarquement confirmé', array['Côté_Gege', 'T030'], 'Gege', 'confirmee');
  end if;
end $$;
