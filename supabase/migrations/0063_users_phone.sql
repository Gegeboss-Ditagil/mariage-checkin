-- v1.69.0, demande de Gersom le 07/10/2026 (message vocal) : "pour les
-- numeros de telephone [du staff], regarde dans la base de donnees...
-- peux-tu t'organiser pour mettre les numeros de telephone dans Supabase" --
-- utilise pour calculer le PIN (4 derniers chiffres) des comptes
-- agent_checkin dont le telephone est identifiable avec certitude par
-- correspondance de nom avec invitations.telephone (jamais invente pour un
-- compte generique sans nom complet). Simple colonne de donnees, aucune
-- logique d'authentification ne la lit directement (pin_hash reste la seule
-- source du PIN reel) -- elle sert de traçabilite/reference pour de futures
-- reinitialisations, pas de mecanisme de connexion alternatif.
alter table users add column if not exists phone text;

comment on column users.phone is
  'Numero de telephone du membre du staff (format international, ex: +33612345678), quand identifiable avec certitude -- purement informatif/de reference (ex: calcul du PIN = 4 derniers chiffres). Jamais lu par la connexion elle-meme (pin_hash/password_hash restent la seule source).';
