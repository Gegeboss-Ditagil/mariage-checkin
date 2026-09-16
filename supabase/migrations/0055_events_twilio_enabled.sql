-- v1.53.2, retour de Gersom (16/09/2026, capture d'ecran "Demande
-- d'approbation" affichant en rouge "Le message Twilio n'est pas parti
-- (Twilio desactive ou non configure...)") : Twilio (SMS + WhatsApp de
-- l'approbation d'invites surprise) reste desactive intentionnellement
-- ("c'est toggle off... on activera plus tard", deja acte en v1.48.3 via la
-- variable d'environnement TWILIO_ENABLED) -- mais tant que c'est le cas,
-- l'agent qui soumet une demande voit ce message d'erreur a chaque fois,
-- alors que ce n'est PAS un probleme reel : "si c'est desactive, tous ces
-- problemes-la disparaissent". Demande explicite : "mets un bouton dans le
-- parametre de la page admin pour activer/desactiver cette fonctionnalite" --
-- remplace le toggle par variable d'environnement (qui exigeait un acces
-- Vercel) par une colonne persistee, modifiable directement depuis /admin.
alter table events add column if not exists twilio_enabled boolean not null default false;

comment on column events.twilio_enabled is
  'Active/desactive l''envoi reel de SMS/WhatsApp Twilio pour les approbations d''invite surprise (voir lib/twilio.ts). Faux par defaut -- remplace la variable d''environnement TWILIO_ENABLED (v1.48.3), modifiable directement depuis /admin (PATCH /api/admin/event) sans acces Vercel. Quand faux, aucune requete reseau Twilio n''est tentee et l''agent qui soumet une demande ne voit plus aucun message d''erreur a ce sujet -- ce n''est pas un probleme tant que ce toggle reste volontairement desactive.';
