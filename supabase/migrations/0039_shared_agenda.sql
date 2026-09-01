-- v1.30.0 - Agenda partage, modifiable par admin/directeur seulement.
create table if not exists agenda_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  time_label text not null,
  title text not null,
  department text not null default 'Coordination',
  details text,
  sort_order numeric(10,3) not null,
  assignee_ids uuid[] not null default '{}',
  completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references users(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_agenda_items_event_order on agenda_items(event_id, sort_order);
alter table agenda_items enable row level security;

-- La session de l'application est geree cote serveur (cookie signe), donc
-- aucune policy anon/authenticated : les routes API utilisent service_role.

insert into agenda_items (event_id, time_label, title, department, details, sort_order)
select e.id, seed.time_label, seed.title, seed.department, seed.details, seed.sort_order
from events e
cross join (values
  ('08:00','Décorateurs au Festif Chambly','Décoration','Tables, chaises, nappes, fleurs, centres de table et arche.',10),
  ('09:00','DJ et sonorisation','Technique','Installation des haut-parleurs, micros, éclairage et tests.',20),
  ('10:00','Traiteur','Restauration','Préparation du vin d’honneur, cocktails, entrées, plat principal, desserts et bar.',30),
  ('11:30','Photographe et vidéaste','Média','Photos, détails, préparatifs et coulisses.',40),
  ('12:00','Départ vers Château Jeanne & The Forest','Transport',null,50),
  ('12:00–13:00','Grande séance photo','Média',null,60),
  ('13:30','Départ vers le Festif Chambly','Transport',null,70),
  ('14:50','Arrivée au Festif','Accueil',null,80),
  ('15:00','Cérémonie religieuse','Cérémonie',null,90),
  ('15:45','Séance photo rapide','Média',null,100),
  ('16:00','Vin d’honneur','Restauration',null,110),
  ('16:20','Départ discret des mariés','Coordination',null,120),
  ('16:30–17:50','Socialisation','Accueil',null,130),
  ('18:00–18:30','Entrée officielle des mariés','Animation',null,140),
  ('18:30–19:00','Discours et animations','Animation',null,150),
  ('19:00–20:50','Service du buffet','Restauration',null,160),
  ('20:00','Mise en opération de la zone média','Média',null,170),
  ('21:00','Première danse des mariés','Animation',null,180),
  ('22:30','Ouverture du bal','Animation',null,190),
  ('22:50','Arrivée de la prestation gâteau','Restauration',null,200),
  ('01:00','Extinction des lumières et changement d’ambiance','Technique',null,210),
  ('03:00','Fermeture du bar','Restauration',null,220),
  ('05:00','Fin de la soirée','Coordination',null,230)
) as seed(time_label,title,department,details,sort_order)
where not exists (select 1 from agenda_items ai where ai.event_id = e.id);
