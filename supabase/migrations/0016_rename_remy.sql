-- Corrige l'orthographe du nom de Remy sans toucher a son UUID, son PIN,
-- son role ni son historique. L'UUID stable rend la migration idempotente.
update users
set
  nom_affichage = 'Remy',
  nom_complet = 'Remy Landu'
where id = 'b8c2cfbc-f55b-481e-b080-0343e911d56e';
