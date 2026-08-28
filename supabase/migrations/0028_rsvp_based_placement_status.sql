-- v1.19.0 (28/08/2026, demande explicite de Gersom) : redefinit
-- placement_status pour refleter la confiance RSVP plutot que le fait que
-- la table ait ete assignee via un tag CSV explicite ou par l'algorithme.
-- Voir docs/BUSINESS_RULES.md et lib/withjoyImport.ts::rsvpConfirmed --
-- meme regle ici : "confirmee" seulement si CHAQUE membre du groupe a une
-- reponse RSVP commencant par "Oui" (le texte With Joy reel est "Oui,
-- embarquement confirme" -- prefixe, pas egalite stricte), sinon
-- "provisoire" (reponse "Peut-etre", ou aucune donnee RSVP disponible pour
-- cette invitation). meme regle appliquee dans scripts/assign_tables_
-- from_labels.py (voir l'avertissement deja present dans
-- 0023_sync_needs_table_tag_rules.sql et docs/QE_QA_PROCESS.md : une meme
-- regle metier implementee plusieurs fois peut diverger silencieusement).
--
-- provisoire_reserve reste dans le type/la contrainte pour compatibilite
-- mais n'est plus jamais produit -- le fait d'etre en reserve se lit
-- directement via table_id + tables.is_reserve, independamment de
-- placement_status. Aucune ligne n'avait cette valeur au moment de cette
-- migration (verifie avant application).
--
-- Recalcule les 243 invitations existantes (369+11 personnes) avec la
-- meme regle, pour que l'affichage reste coherent immediatement (pas
-- seulement au prochain reimport CSV). Previsualise avant application :
-- 170 restent confirmee (254 personnes), 62 passent confirmee->provisoire
-- (115 personnes, RSVP Peut-etre ou absente), 7 passent
-- provisoire->confirmee (7 personnes, RSVP Oui mais table auto-assignee),
-- 4 restent provisoire.
--
-- Sauvegarde d'abord l'etat pre-migration (id + ancien statut + notes) dans
-- une table dediee, pour un retour arriere exact si necessaire :
--   update invitations i set placement_status = b.placement_status
--   from placement_status_backup_20260828 b where b.id = i.id;

create table if not exists placement_status_backup_20260828 as
select id, placement_status, notes
from invitations;

alter table placement_status_backup_20260828 enable row level security;
revoke all on table placement_status_backup_20260828 from public, anon, authenticated;
grant all on table placement_status_backup_20260828 to service_role;

with computed as (
  select
    id,
    case
      when notes ~ '^RSVP: '
        and btrim(regexp_replace(split_part(notes, '|', 1), '^RSVP: ', '')) <> ''
        and not exists (
          select 1
          from unnest(string_to_array(regexp_replace(split_part(notes, '|', 1), '^RSVP: ', ''), ' / ')) as v
          where btrim(v) !~ '^Oui'
        )
      then 'confirmee'
      else 'provisoire'
    end as new_status
  from invitations
)
update invitations i
set placement_status = c.new_status
from computed c
where c.id = i.id and i.placement_status is distinct from c.new_status;
