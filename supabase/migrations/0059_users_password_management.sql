-- ============================================================================
-- Systeme de gestion des mots de passe/PIN (demande de Gersom, 03/10/2026,
-- message vocal en deux parties) :
--   - "l'admin principal... peut changer les mots de passe... et meme voir
--     les mots de passe" (avec anonymisation -- seulement les deux derniers
--     caracteres, le reste en asterisques, pour "rappeler" un mot de passe
--     avant de reinitialiser) ;
--   - "les directeurs de festin... peuvent faire la reinitialisation...
--     sauf aux admins" ;
--   - "les admins peuvent faire la meme chose et... reinitialiser les mots
--     de passe des directeurs de festin" ;
--   - "l'admin principal... peut le faire pour tout le monde... la seule
--     personne qui a de la visibilite sur tout... c'est Gersom".
--
-- `is_super_admin` distingue UN SEUL compte admin (confirme explicitement
-- par Gersom : le compte "Admin" / gersomdos@gmail.com -- son compte
-- personnel "Dos" reste un admin normal, pour "separer les pouvoirs... et
-- pouvoir un jour si necessaire deleguer l'admin principal" a un autre
-- compte). Volontairement une colonne sur `users`, jamais un sixieme role
-- dans l'enum Role (admin/directeur/placeur/agent_checkin/visibilite) :
-- ce compte reste un admin ordinaire pour tout le reste de l'application,
-- seule la gestion des mots de passe distingue ce statut.
--
-- `pin_reset_hint` stocke un indice MASQUE (ex: "**34") du PIN actuellement
-- actif, mis a jour uniquement par la reinitialisation aleatoire (jamais le
-- PIN en clair ni reversible) -- voir lib/passwordReset.ts. NULL tant
-- qu'aucune reinitialisation n'est encore passee par ce systeme (comptes
-- deja existants avant cette version).
-- ============================================================================

alter table public.users add column if not exists is_super_admin boolean not null default false;
alter table public.users add column if not exists pin_reset_hint text;

update public.users set is_super_admin = true where role = 'admin' and email = 'gersomdos@gmail.com';
