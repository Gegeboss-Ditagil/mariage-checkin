-- v1.67.0, retour de Gersom (message vocal) : "rajouter un processus de
-- sécurité pour ne pas qu'on puisse brute force les tentatives... maximum
-- 10 tentatives de suite erronées... pour pas se faire pirater facilement,
-- pour pas qu'il y ait quelqu'un qui nous sabote."
--
-- Le PIN de connexion (mode 'pin', nom_affichage + 4 chiffres) n'a que
-- 10 000 combinaisons possibles et n'était protégé par aucune limite de
-- tentatives -- brute-forçable en quelques minutes par un script sans
-- aucune des deux colonnes ajoutées ici. Voir lib/loginLockout.ts pour la
-- logique (10 tentatives consécutives -> verrouillage 15 minutes, remis à
-- zéro après une connexion réussie OU une fois le verrouillage expiré).
alter table public.users add column if not exists failed_login_attempts integer not null default 0;
alter table public.users add column if not exists locked_until timestamptz;
