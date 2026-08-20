# Données, Supabase, Google Sheets et formulaires

Lire `BUSINESS_RULES.md` avant toute modification. Supabase est la source utilisée en production; Google Sheets sert à préparer et réviser le placement. Il n'existe pas de synchronisation automatique implicite.

## Formulaires d'écriture

| Parcours | Écriture principale | Rôles |
|---|---|---|
| Connexion | session signée, cookies de rôle/nom | Tous comptes actifs |
| Check-in/correction/annulation | invitations, checkins, audit | Admin, directeur, placeur, agent scan |
| Membres | guests, invitation_guests, nombre prévu | Admin, directeur, placeur, agent scan |
| Ne viendra pas | invitations, audit | Admin, directeur, placeur, agent scan |
| Affecter débordement | overflow_assignments, audit | Admin, directeur, placeur, agent scan |
| Déplacer/retirer débordement | overflow_assignments, audit | Admin, directeur, placeur |
| Déplacer invitation | invitations, audit | Admin, directeur, placeur |
| Ajouter invitation | invitations | Admin, directeur, placeur |
| Import/administration | tables, invitations, users, événement | Admin uniquement |

## Instructions aux agents IA

- Ne jamais écrire en production sans autorisation explicite et aperçu des lignes affectées.
- Ne jamais exposer la clé `service_role`, désactiver RLS ou contourner une autorisation UI/API.
- Préserver UUID, arrivées, membres, débordements et journaux pendant un réimport.
- Conserver les zéros initiaux des PIN et téléphones dans Google Sheets/CSV.
- Détecter doublons, tables inconnues, invitations sans table et nombres invalides avant import.
- Documenter tables, fonctions, lignes affectées, contrôle avant/après et procédure de retour arrière.
- Toute évolution de formulaire doit préciser champs, validation client, validation serveur, API, rôle et effet secondaire.

## Procédure obligatoire pour Supabase

1. Identifier l'environnement et confirmer explicitement s'il s'agit de production.
2. Lire les migrations existantes et les fonctions SQL avant de proposer une modification; ne jamais éditer une ancienne migration déjà appliquée.
3. Produire une nouvelle migration réversible, avec contraintes, index, RLS et politiques nécessaires.
4. Avant toute écriture manuelle, fournir la requête de prévisualisation (`select`), le nombre de lignes attendu et la requête de retour arrière.
5. Tester d'abord avec des données fictives ou dans un environnement de test. Pour une opération concurrente (check-in, déplacement, débordement), préférer une fonction SQL transactionnelle à plusieurs écritures client séparées.
6. Après application, vérifier les contraintes, les politiques RLS, les rôles autorisés, les données affectées et les journaux d'audit.

Interdictions : supprimer une table ou une colonne sans plan de migration, utiliser `service_role` dans le navigateur, rendre une table publique pour contourner RLS, modifier directement les totaux d'arrivée sans passer par la logique d'audit.

## Procédure obligatoire pour Google Sheets et CSV

1. Travailler sur une copie et conserver l'original daté.
2. Traiter les PIN, téléphones, codes QR et identifiants comme du texte afin de préserver les zéros initiaux.
3. Ne pas changer les en-têtes attendus sans modifier et tester le mapping d'import.
4. Avant export/import, contrôler : doublons, cellules obligatoires vides, numéros de table inconnus, nombres négatifs, formats de téléphone/email et total des personnes.
5. Présenter un bilan avant écriture : lignes ajoutées, modifiées, ignorées et en erreur.
6. Après import Supabase, comparer les totaux par table et le total général avec la feuille source.

Google Sheets n'est pas la base temps réel du jour J : une correction dans la feuille ne modifie pas automatiquement Supabase. Toute resynchronisation doit être explicitement demandée, simulée puis contrôlée.

## Contrat minimal d'un formulaire

Pour chaque formulaire, documenter dans la PR :

- les champs, types, valeurs par défaut et champs obligatoires;
- les validations identiques côté client et côté serveur;
- la capacité exigée dans `lib/permissions.ts`;
- l'endpoint appelé et les tables/fonctions Supabase touchées;
- les effets secondaires (audit, compteurs, capacité, temps réel);
- le comportement hors ligne, en double clic et en concurrence;
- les messages français présentés pour chaque erreur métier;
- au moins un test autorisé et un test refusé.
