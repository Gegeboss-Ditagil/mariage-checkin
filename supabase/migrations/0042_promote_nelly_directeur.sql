-- v1.31.1 - Nelly recoit exactement la meme matrice de droits que les
-- directeurs de festin (Remy, Tuzola, Sem), sans exception nominative.
update users
set role = 'directeur'
where nom_affichage = 'Nelly Lukau'
   or nom_complet = 'Nelly Dos Goncalves';
