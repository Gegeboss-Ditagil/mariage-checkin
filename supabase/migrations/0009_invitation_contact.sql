-- ============================================================================
-- Ajoute telephone/email directement sur invitations (au lieu de la table
-- "guests" qui n'est pas utilisee par l'app), + une colonne generee avec les
-- chiffres uniquement du telephone pour permettre une recherche tolerante
-- aux indicatifs pays (+33 / 0033 / 0 ...) : on compare simplement la fin des
-- numeros, sans se soucier du prefixe.
-- ============================================================================

alter table invitations add column if not exists telephone text;
alter table invitations add column if not exists email text;

alter table invitations add column if not exists telephone_digits text
  generated always as (regexp_replace(coalesce(telephone, ''), '[^0-9]', '', 'g')) stored;

create index if not exists idx_invitations_telephone_digits on invitations(telephone_digits);
