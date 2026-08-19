-- ============================================================================
-- nom_complet : nom complet affiche une fois connecte (en haut a droite de
-- l'app + message de bienvenue), separe de nom_affichage qui reste
-- l'identifiant court utilise pour se connecter (ex: "Dos", "Landu").
-- Optionnel : si non renseigne, l'app retombe sur nom_affichage.
-- ============================================================================

alter table users add column if not exists nom_complet text;

update users set nom_complet = 'Gersom Mbidi' where nom_affichage = 'Dos';
update users set nom_complet = 'Remi Landu' where nom_affichage = 'Remi Landu';
update users set nom_complet = 'Tuzola Saviera' where nom_affichage = 'Tuzola';
update users set nom_complet = 'Nelly Dos Goncalves' where nom_affichage = 'Nelly Lukau';
update users set nom_complet = 'Sem Landu' where nom_affichage = 'Sem Landu';

update users set nom_complet = 'Jean-Claude Onokoko' where nom_affichage = 'Onokoko';
update users set nom_complet = 'Thomas Wandubula' where nom_affichage = 'Wandubula';
update users set nom_complet = 'Barnabé Shungu' where nom_affichage = 'Shungu';
update users set nom_complet = 'Lucien Shampe' where nom_affichage = 'Shampe';
update users set nom_complet = 'Isaac Lotisi' where nom_affichage = 'Lotisi';
update users set nom_complet = 'Ahicam Damuna' where nom_affichage = 'Damuna';
update users set nom_complet = 'Glody Kambwa' where nom_affichage = 'Kambwa';
update users set nom_complet = 'Jeremie Luyindula' where nom_affichage = 'Luyindula';
update users set nom_complet = 'Ruben Lopez' where nom_affichage = 'Lopez';
update users set nom_complet = 'Brady Landu' where nom_affichage = 'Landu';
update users set nom_complet = 'Skoty Sanda' where nom_affichage = 'Sanda';
update users set nom_complet = 'Mickael Ribeiro' where nom_affichage = 'Ribeiro';
update users set nom_complet = 'Jerry Muzezenu' where nom_affichage = 'Muzezenu';
