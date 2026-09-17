-- ============================================================================
-- Visibilite privee des elements de l'agenda -- demande explicite de Gersom
-- (17/09/2026, message vocal) : "peut-etre que ce n'est pas visible pour les
-- agents scanners et les agents placeurs, seulement pour les directeurs de
-- festins... tu mets l'option prive ou pas... c'est vraiment cache de tous,
-- sauf pour les directeurs de festin et administrateurs."
--
-- `is_private = true` retire l'element de la reponse de GET /api/agenda pour
-- tout role sans la capacite `manageAgenda` (admin/directeur uniquement,
-- lib/permissions.ts) -- exactement le meme decoupage que celui qui protege
-- deja la creation/modification d'un element, aucune nouvelle capacite
-- necessaire. Filtrage cote serveur (jamais un simple masquage CSS cote
-- client) : un agent scan/placeur ne recoit meme pas la ligne dans le JSON.
alter table public.agenda_items
  add column if not exists is_private boolean not null default false;

comment on column public.agenda_items.is_private is
  'true = visible seulement par admin/directeur (capacite manageAgenda) -- filtre cote serveur dans GET /api/agenda, jamais expose aux autres roles.';
