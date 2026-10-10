-- ============================================================================
-- v1.79.0 (10/10/2026) -- signalé par Gersom : « Sergio et Test, que j'ai mis
-- en table 1 pendant le mode test, sont encore là... quand j'appuie sur le
-- bouton rouge, ça devrait les enlever ».
--
-- reset_test_event_data (0069) remettait les arrivées à zéro et retirait les
-- personnes ajoutées sur place (« + »), mais PAS les invités surprise
-- approuvés : une approbation crée une vraie invitation (note « Invité
-- surprise approuvé… », jamais d'identifiant With Joy), que la
-- réinitialisation laissait en place, ni les demandes d'approbation.
--
-- Désormais le bouton rouge (refusé en mode JOUR J, comme avant) retire
-- aussi :
--   * les invitations créées par une approbation d'invité surprise (et leurs
--     personnes), repérées par la note posée par les fonctions d'approbation
--     (0032, 0038, 0045, 0046, 0049, 0056) ET l'absence d'identifiant With Joy
--     -- jamais une invitation importée ;
--   * toutes les demandes d'approbation de l'événement.
-- Les invitations importées gardent leurs noms, tables et étiquettes ; seuls
-- leurs compteurs et pointages sont remis à zéro (inchangé).
-- ============================================================================

create or replace function reset_test_event_data(p_event_id uuid)
returns void as $$
declare
  v_status text;
begin
  select status into v_status
    from events
    where id = p_event_id
    for update;

  if not found then
    raise exception 'event_not_found';
  end if;

  if v_status = 'live' then
    raise exception 'event_live';
  end if;

  delete from checkins where event_id = p_event_id;
  delete from overflow_assignments where event_id = p_event_id;
  delete from exceptions where event_id = p_event_id;
  delete from audit_logs where event_id = p_event_id;

  -- Demandes d'invité surprise faites pendant les tests.
  delete from guest_approval_requests where event_id = p_event_id;

  -- Invités surprise approuvés pendant les tests : leurs personnes, puis
  -- l'invitation elle-même (invitation_guests part en cascade).
  delete from guests g
    using invitation_guests ig, invitations i
    where ig.guest_id = g.id and ig.invitation_id = i.id
      and i.event_id = p_event_id
      and i.notes like 'Invité surprise approuvé%'
      and i.withjoy_party_id is null;
  delete from invitations i
    where i.event_id = p_event_id
      and i.notes like 'Invité surprise approuvé%'
      and i.withjoy_party_id is null;

  -- Personnes ajoutées sur place pendant les tests : retirées.
  delete from guests g
    using invitation_guests ig, invitations i
    where ig.guest_id = g.id and ig.invitation_id = i.id
      and i.event_id = p_event_id and g.is_unplanned;

  -- Pointage par personne remis à « attendu » (« ne viendra pas » conservé :
  -- c'est une donnée de préparation, pas un test d'arrivée).
  update guests g
    set arrival_status = 'attendu'
    from invitation_guests ig, invitations i
    where ig.guest_id = g.id and ig.invitation_id = i.id
      and i.event_id = p_event_id and g.arrival_status = 'arrive';

  update invitations
    set nombre_arrive = 0,
        nombre_supplementaire = 0,
        statut = 'non_arrive',
        updated_at = now()
    where event_id = p_event_id;
end;
$$ language plpgsql security invoker set search_path = public, pg_temp;
