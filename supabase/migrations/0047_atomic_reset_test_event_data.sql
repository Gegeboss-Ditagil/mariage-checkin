-- Reinitialisation de test atomique et protegee contre le mode LIVE.
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

  update invitations
    set nombre_arrive = 0,
        nombre_supplementaire = 0,
        statut = 'non_arrive',
        updated_at = now()
    where event_id = p_event_id;
end;
$$ language plpgsql security invoker set search_path = public, pg_temp;
