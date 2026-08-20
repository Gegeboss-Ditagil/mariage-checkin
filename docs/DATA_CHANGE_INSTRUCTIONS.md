# Instructions pour les modifications de données

## 1. Principe général

L'application contient les données réelles du mariage de Nelly et Gersom. Toute modification de Supabase, Google Sheets, des scripts d'import ou des formulaires doit être considérée comme sensible.

Ne jamais modifier, supprimer, réimporter ou réinitialiser les données réelles sans une demande explicite de Gersom.

## 2. Sources de vérité

Les systèmes ont des responsabilités différentes :

- Google Sheets : préparation et révision humaine du placement.
- Fichiers CSV/XLSX : fichiers d'échange et d'import.
- Supabase : source de vérité utilisée par l'application en production.
- Dépôt GitHub : source de vérité pour le schéma, les migrations, les scripts et les règles métier.
- README et documents dans `docs/` : description fonctionnelle à maintenir avec le code.

Ne jamais supposer que Google Sheets est automatiquement synchronisé avec Supabase.

## 3. Avant toute modification

L'agent doit obligatoirement :

1. Lire les règles métier et la matrice des rôles.
2. Identifier l'environnement concerné : test ou production.
3. Identifier les tables, fonctions, formulaires et scripts touchés.
4. Mesurer l'état avant changement :

   - nombre d'invitations ;
   - nombre total de personnes prévues ;
   - nombre de tables ;
   - invitations sans table ;
   - débordements existants ;
   - arrivées déjà enregistrées.

5. Préparer un aperçu exact des lignes qui seront ajoutées, modifiées ou supprimées.
6. Obtenir l'autorisation explicite de Gersom avant toute écriture en production.
7. Prévoir une méthode de retour arrière.

## 4. Données actuelles à surveiller

Les chiffres peuvent évoluer pendant le nettoyage de la liste, mais le dernier état documenté était :

- 423 personnes prévues ;
- 200 invitations ou groupes ;
- 44 tables ;
- objectif final d'environ 400 personnes.

Ces chiffres ne doivent jamais être codés comme des contraintes permanentes. Ils servent uniquement à détecter une variation inattendue.

## 5. Identifiants

Ne jamais remplacer les identifiants Supabase par les numéros de ligne d'un Google Sheet.

Les relations doivent continuer à utiliser les UUID :

- `event_id`
- `table_id`
- `invitation_id`
- `guest_id`
- `reserve_table_id`
- `agent_id`

Le numéro visible d'une table n'est pas son identifiant technique.

## 6. Import Google Sheets, CSV ou XLSX

Avant un import :

- travailler sur une copie du fichier ;
- conserver une colonne stable permettant de reconnaître les invitations existantes ;
- normaliser les noms de colonnes ;
- conserver les zéros initiaux des numéros de téléphone et des PIN ;
- vérifier les caractères accentués ;
- détecter les doublons ;
- détecter les tables inexistantes ;
- vérifier les nombres de personnes négatifs, nuls ou anormalement élevés ;
- afficher un aperçu avant validation.

Un import ne doit jamais, par défaut :

- effacer les invitations absentes du nouveau fichier ;
- remettre `nombre_arrive` à zéro ;
- supprimer les membres détaillés ;
- annuler les débordements ;
- changer les UUID ;
- supprimer l'historique ou les journaux d'audit ;
- écraser les modifications réalisées pendant le mariage.

Les actions de création, mise à jour et suppression doivent être présentées séparément.

## 7. Formulaires de l'application

Pour chaque formulaire modifié, documenter :

- les champs affichés ;
- les champs obligatoires ;
- les valeurs par défaut ;
- les validations côté client ;
- les validations côté serveur ;
- la route API appelée ;
- les tables ou fonctions Supabase touchées ;
- les rôles autorisés ;
- les effets secondaires ;
- le comportement en cas de double action ou de connexion faible.

Les validations côté interface ne remplacent jamais les contrôles côté serveur.

## 8. Règles essentielles

### Invitations

- Une invitation représente généralement un foyer ou un groupe.
- `nombre_prevu` représente le nombre attendu.
- `nombre_arrive` représente le total déjà enregistré.
- Une invitation peut temporairement ne pas avoir de table.
- Une invitation déplacée conserve son historique et ses membres.

### Membres

- Les membres détaillés sont optionnels.
- Retirer un membre diminue également le nombre prévu du groupe.
- Renommer un membre ne doit pas modifier le nombre prévu.
- Initialiser les membres ne doit pas créer de doublons en cas de double validation.

### Check-in

- Une validation doit être atomique.
- Deux téléphones ne doivent pas compter deux fois la même action.
- Toute correction doit être historisée.
- L'annulation doit viser uniquement la dernière opération annulable.
- Une opération annulée ne doit pas disparaître de l'audit.

### Tables

- La capacité physique et l'occupation estimée sont deux notions différentes.
- Déplacer une invitation ne doit pas supprimer ses arrivées.
- Une table affichée complète peut recevoir une affectation uniquement après confirmation explicite.
- Les tables de réserve ne sont pas les seules tables pouvant recevoir un débordement.

### Débordements

- Un débordement appartient à une invitation et à une table de destination.
- Il ne doit jamais être assigné deux fois.
- Le déplacement ou le retrait doit être atomique et audité.
- Un agent scan peut affecter un débordement pendant le check-in.
- Seuls admin, directeur et placeur peuvent réorganiser un débordement déjà affecté.

## 9. Sécurité Supabase

- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` dans le navigateur, les logs, GitHub ou Google Sheets.
- Ne jamais placer une clé secrète dans une variable `NEXT_PUBLIC_*`.
- Vérifier les politiques RLS et les autorisations serveur.
- Ne jamais utiliser une information modifiable par l'utilisateur comme preuve de rôle.
- Les autorisations doivent être vérifiées côté serveur, même si le bouton est masqué dans l'interface.
- Une migration ne doit pas contourner RLS avec `SECURITY DEFINER` sans justification et audit explicites.

## 10. Migrations

Toute modification de schéma doit :

1. être réalisée dans une migration versionnée ;
2. être réversible ou accompagnée d'une procédure de restauration ;
3. éviter les suppressions destructrices immédiates ;
4. préserver les données existantes ;
5. être testée sur une copie ou un environnement de test ;
6. passer les contrôles Supabase et TypeScript ;
7. être documentée dans la PR.

Ne jamais modifier manuellement la production puis oublier de reporter le changement dans les migrations GitHub.

## 11. Tests obligatoires avant publication

Tester les cinq rôles :

- admin ;
- directeur ;
- placeur ;
- agent scan ;
- visibilité.

Tester au minimum :

- connexion et destination après connexion ;
- navigation autorisée et interdite ;
- recherche ;
- scan ;
- consultation d'une table ;
- check-in ;
- correction et annulation ;
- membres d'un groupe ;
- débordement ;
- déplacement ;
- dashboard ;
- export ;
- comportement avec connexion lente ou perdue.

Tester également les appels API directs. Masquer un bouton ne constitue pas une protection.

## 12. Compte rendu obligatoire

À la fin, l'agent doit indiquer :

- ce qui a été modifié ;
- pourquoi ;
- les tables et fonctions touchées ;
- le nombre de lignes affectées ;
- les contrôles exécutés ;
- les résultats avant/après ;
- les risques restants ;
- la procédure de retour arrière ;
- les documents mis à jour.

## 13. Interdictions absolues sans autorisation

Ne jamais :

- réinitialiser la production ;
- supprimer récursivement des données ;
- vider une table ;
- lancer un import destructif ;
- modifier massivement les placements ;
- réinitialiser les arrivées ;
- changer les comptes ou PIN ;
- désactiver RLS ;
- partager les clés Supabase ;
- utiliser les vrais invités pour des tests d'écriture non coordonnés ;
- fusionner une PR contenant une migration sans vérification et autorisation explicites.

