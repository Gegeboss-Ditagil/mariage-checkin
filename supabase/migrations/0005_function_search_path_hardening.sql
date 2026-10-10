-- Restaurée en v1.75.0 depuis supabase_migrations.schema_migrations (version
-- 20260818005046) : appliquée en production le 18/08/2026 mais jamais
-- versionnée dans le dépôt -- trouvée par tests/project-hygiene.test.ts
-- (numérotation sans trou). Contenu identique à ce qui a été exécuté.
alter function set_updated_at() set search_path = public, pg_temp;
alter function record_checkin(uuid, uuid, int, boolean, int) set search_path = public, pg_temp;
alter function cancel_last_checkin(uuid, uuid) set search_path = public, pg_temp;
alter function assign_overflow(uuid, uuid, int, uuid) set search_path = public, pg_temp;
