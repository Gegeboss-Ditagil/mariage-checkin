-- ============================================================================
-- Row Level Security
--
-- Principe retenu pour cet outil interne (usage prive, derriere une page de
-- connexion applicative) :
--   - Toutes les ECRITURES passent exclusivement par les routes API Next.js,
--     qui utilisent la cle SUPABASE_SERVICE_ROLE_KEY (jamais exposee au
--     navigateur). La service role contourne RLS par defaut : donc aucune
--     policy INSERT/UPDATE/DELETE n'est necessaire pour le fonctionnement
--     normal de l'app.
--   - Le navigateur (cle anon, publique) a uniquement le droit de LIRE
--     certaines tables, pour permettre le dashboard et les abonnements
--     Realtime en direct. C'est ce qui permet la synchronisation multi-agents
--     sans repasser par le serveur pour chaque rafraichissement d'ecran.
--   - users (comptes/roles) et audit_logs (journal) NE sont PAS lisibles cote
--     client : ils passent par des routes API qui verifient la session.
--
-- Limite connue : la cle anon + l'URL du projet, si elles fuitent, permettent
-- de LIRE les invites/tables/checkins (pas de les modifier). Acceptable pour
-- un outil interne a diffusion restreinte ; a durcir avec Supabase Auth si
-- besoin d'une securite plus stricte plus tard.
-- ============================================================================

alter table events enable row level security;
alter table tables enable row level security;
alter table guests enable row level security;
alter table invitations enable row level security;
alter table invitation_guests enable row level security;
alter table qr_codes enable row level security;
alter table checkins enable row level security;
alter table overflow_assignments enable row level security;
alter table users enable row level security;
alter table audit_logs enable row level security;

create policy "public read events" on events for select using (true);
create policy "public read tables" on tables for select using (true);
create policy "public read guests" on guests for select using (true);
create policy "public read invitations" on invitations for select using (true);
create policy "public read invitation_guests" on invitation_guests for select using (true);
create policy "public read qr_codes" on qr_codes for select using (true);
create policy "public read checkins" on checkins for select using (true);
create policy "public read overflow_assignments" on overflow_assignments for select using (true);

-- users et audit_logs : aucune policy de lecture publique -> accessibles
-- uniquement via service role (routes API serveur).
