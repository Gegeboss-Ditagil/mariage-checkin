-- Métadonnées issues de With Joy pour expliquer et réviser le placement.
-- Le numéro 0017 évite la collision avec la migration historique 0007_overflow_manage.sql.
alter table invitations add column if not exists cote text
  check (cote in ('Nelly', 'Gege', 'Neutre'));

alter table invitations add column if not exists tags text[] not null default '{}';

alter table invitations add column if not exists placement_status text
  not null default 'provisoire'
  check (placement_status in ('confirmee', 'provisoire', 'provisoire_reserve'));

create index if not exists idx_invitations_cote on invitations(cote);

