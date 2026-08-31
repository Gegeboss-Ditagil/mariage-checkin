-- Approbations dans l'application + abonnements Web Push privés (v1.28.0).
-- Les abonnements ne sont jamais exposés au client Supabase : toutes les
-- lectures/écritures passent par des routes serveur authentifiées.

alter table guest_approval_requests drop constraint if exists guest_approval_requests_decided_via_check;
alter table guest_approval_requests
  add constraint guest_approval_requests_decided_via_check
  check (decided_via in ('web', 'whatsapp', 'app'));

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
revoke all on table push_subscriptions from anon, authenticated;

create index if not exists idx_push_subscriptions_event_user
  on push_subscriptions(event_id, user_id);
