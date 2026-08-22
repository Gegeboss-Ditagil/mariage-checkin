# Données, Supabase, Google Sheets et formulaires

**Version documentaire : 1.2.2**  
**Dernière mise à jour : 2026-08-22**

Lire `BUSINESS_RULES.md`, `VERSIONING.md` et `DATA_CHANGE_INSTRUCTIONS.md` avant toute modification. Supabase est la source utilisée en production; Google Sheets sert à préparer et réviser le placement. Il n'existe pas de synchronisation automatique implicite.

## État de référence v1.2.2

- 41 tables au total.
- Tables 1 à 40 : normales.
- Table 41 : seule réserve.
- Capacité officielle : 400 places.
- Capacité absolue avec réserve : 410 places.
- Toute évolution structurelle doit être reflétée dans une migration GitHub et dans `CHANGELOG.md`.

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

La page `/staff` est une lecture filtrée de `invitations.category = 'Staff'`. Elle ne crée aucun nouveau type d'écriture : toucher une ligne réutilise le check-in existant. Pour les futurs imports With Joy, `notable` conserve `table_id = NULL` sauf si un tag `Txxx`/`Fxxx` explicite est présent.

`scripts/build_plan_from_csv.py` extrait `phone number` par personne (colonne With Joy) vers `telephone` : pour une invitation groupée, c'est le premier téléphone non vide du foyer. Conformément à la règle d'individuation du staff (`docs/BUSINESS_RULES.md`), le script isole chaque personne portant un tag de rôle staff dans sa propre invitation — y compris quand plusieurs membres d'un même foyer sont staff — pour permettre de cocher l'arrivée de chacun séparément ; les membres non-staff du même foyer restent groupés.

## Instructions aux agents IA

- Relever la version dans `package.json` avant toute modification.
- Ne jamais écrire en production sans autorisation explicite et aperçu des lignes affectées.
- Ne jamais exposer la clé `service_role`, désactiver RLS ou contourner une autorisation UI/API.
- Préserver UUID, arrivées, membres, débordements et journaux pendant un réimport.
- Conserver les zéros initiaux des PIN et téléphones dans Google Sheets/CSV.
- Détecter doublons, tables inconnues, invitations sans table et nombres invalides avant import.
- Documenter tables, fonctions, lignes affectées, contrôle avant/après et procédure de retour arrière.
- Toute évolution de formulaire doit préciser champs, validation client, validation serveur, API, rôle et effet secondaire.
- Toute évolution fonctionnelle doit mettre à jour la version/changelog/docs selon `docs/VERSIONING.md`.

## Procédure obligatoire pour Supabase

1. Identifier l'environnement et confirmer explicitement s'il s'agit de production.
2. Lire les migrations existantes et les fonctions SQL avant de proposer une modification; ne jamais éditer une ancienne migration déjà appliquée.
3. Produire une nouvelle migration réversible, avec contraintes, index, RLS et politiques nécessaires.
4. Avant toute écriture manuelle, fournir la requête de prévisualisation (`select`), le nombre de lignes attendu et la requête de retour arrière.
5. Tester d'abord avec des données fictives ou dans un environnement de test. Pour une opération concurrente, préférer une fonction SQL transactionnelle.
6. Après application, vérifier contraintes, RLS, rôles, données affectées et audit.
7. Reporter immédiatement toute modification manuelle de production dans une migration GitHub et le changelog de la version concernée.

## Procédure obligatoire pour Google Sheets et CSV

1. Travailler sur une copie et conserver l'original daté.
2. Traiter PIN, téléphones, codes QR et identifiants comme du texte.
3. Ne pas changer les en-têtes attendus sans modifier et tester le mapping d'import.
4. Avant export/import, contrôler doublons, champs obligatoires, tables inconnues, nombres invalides, téléphone/email et total des personnes.
5. Présenter un bilan avant écriture : ajoutées, modifiées, ignorées, erreurs.
6. Après import Supabase, comparer les totaux par table et le total général avec la source.

Google Sheets n'est pas la base temps réel du jour J : une correction dans la feuille ne modifie pas automatiquement Supabase.

## Contrat minimal d'un formulaire

Pour chaque formulaire, documenter dans la PR :

- champs, types, valeurs par défaut et obligatoires ;
- validations client et serveur ;
- capacité requise dans `lib/permissions.ts` ;
- endpoint appelé et tables/fonctions Supabase touchées ;
- effets secondaires : audit, compteurs, capacité, temps réel ;
- comportement hors ligne, double clic et concurrence ;
- messages d'erreur métier ;
- au moins un test autorisé et un test refusé ;
- impact de version : `X.Y.Z → A.B.C` ou version inchangée.
