-- ============================================================================
-- Numeros de Remy et Tuzola (directeur de festin), confirmes par Gersom le
-- 30/08/2026, pour le SMS de rapport envoye apres assignation de table --
-- voir supabase/migrations/0032_guest_approvals.sql (festin_directors avait
-- ete laissee vide, numeros pas encore confirmes a ce moment-la).
-- ============================================================================

insert into festin_directors (nom, telephone) values
  ('Rémy Landu', '+33651874779'),
  ('Tuzola', '+33669016803');
