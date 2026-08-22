# Règles métier — Check-in Mariage Nelly & Gersom

**Version documentaire : 1.2.0**  
**Dernière mise à jour : 2026-08-21**

Ce document est la source de vérité fonctionnelle. Toute modification de rôle, navigation, formulaire, API ou donnée doit le respecter et l'ajuster dans le même lot/version.

## Plan de table et placement With Joy

- `/plan-table` est une vue de consultation accessible à tous les rôles autorisés à consulter les tables.
- Un label With Joy `F0xx` ou `T0xx` produit un placement `confirmee`; un placement calculé reste `provisoire` ou `provisoire_reserve`.
- Les tables 1 à 40 sont normales et représentent 400 places officielles.
- La table 41 est l'unique table de réserve; la capacité absolue est donc 410 places.
- `cote`, `tags` et `placement_status` expliquent le placement et ne modifient jamais les totaux de check-in.
- Toute réimportation doit suivre `docs/DATA_CHANGE_INSTRUCTIONS.md` et obtenir une autorisation explicite avant écriture en production.

## Rôles

| Capacité | Admin | Directeur | Placeur | Agent scan | Visibilité |
|---|---:|---:|---:|---:|---:|
| Destination après connexion | Scan | Dashboard | Scan | Scan | Dashboard |
| Scanner un QR | Oui | Oui | Oui | Oui | Non |
| Rechercher et consulter tables/invités | Oui | Oui | Oui | Oui | Oui |
| Confirmer/corriger/annuler un check-in | Oui | Oui | Oui | Oui | Non |
| Gérer les membres et absences | Oui | Oui | Oui | Oui | Non |
| Affecter un débordement pendant le check-in | Oui | Oui | Oui | Oui | Non |
| Déplacer un groupe | Oui | Oui | Oui | Non | Non |
| Réorganiser un débordement déjà affecté | Oui | Oui | Oui | Non | Non |
| Ajouter une invitation individuelle | Oui | Oui | Oui | Non | Non |
| Utiliser l'écran Placement | Oui | Oui | Oui | Non | Non |
| Historique et exceptions | Oui | Oui | Oui | Oui | Non |
| Exporter les données | Oui | Non | Non | Non | Non |
| Panneau admin/import/comptes/configuration | Oui | Non | Non | Non | Non |

## Staff

- Une invitation `category = 'Staff'` apparaît dans `/staff`, indépendamment de son affectation à une table.
- Les cinq rôles peuvent consulter `/staff`; seuls admin, directeur, placeur et agent scan peuvent ouvrir le check-in.
- La section Staff du dashboard est visible uniquement par admin et directeur.
- Le QR littéral `STAFF`, insensible à la casse, ouvre directement `/staff` pour les rôles autorisés à scanner.
- Un tag `notable` signale un membre du staff volontairement sans table. Lors d'un futur import, un tag de table explicite reste prioritaire et produit un avertissement.

## Principes

- Voir une invitation, effectuer son check-in et la déplacer sont trois permissions distinctes.
- Masquer un bouton ne suffit jamais : chaque route API vérifie aussi le rôle côté serveur.
- Le rôle visibilité est strictement en lecture seule et ne doit jamais afficher une caméra.
- Les écritures nécessitent une connexion. Aucun check-in hors ligne n'est mis en file d'attente.
- Une invitation représente un foyer ou groupe; les membres détaillés restent optionnels.
- Les opérations concurrentes doivent être atomiques, historisées et synchronisées en temps réel.
- Une table affichée complète exige une confirmation explicite avant affectation exceptionnelle.
- Les exports, imports, comptes, QR et configuration sont administratifs.
- Une session applicative expire au plus tard après 12 h.
- Une session appartenant à un ancien déploiement est invalide et doit retourner au login.

## Données et capacité

- `nombre_prevu` est le nombre attendu; `nombre_arrive` est le total enregistré.
- Retirer un membre diminue `nombre_prevu`; le renommer ne le modifie pas.
- Déplacer une invitation conserve ses arrivées, membres et historique.
- Un débordement ne doit jamais être assigné deux fois.
- Capacité physique, places libres maintenant et occupation estimée sont des mesures différentes.
