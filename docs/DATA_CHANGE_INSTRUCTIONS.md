# Instructions pour les modifications de données

**Version documentaire : 1.2.2**  
**Dernière mise à jour : 2026-08-22**

## 1. Principe général

L'application contient les données réelles du mariage. Toute modification de Supabase, Google Sheets, des scripts d'import ou des formulaires doit être considérée comme sensible.

Ne jamais modifier, supprimer, réimporter ou réinitialiser les données réelles sans une demande explicite de Gersom.

Pour toute correction faisant suite à un bug signalé, suivre `docs/QE_QA_PROCESS.md` en plus des règles ci-dessous (reproduction avec les vraies données, recherche des cas similaires par requête groupée, test de régression avant de clore).

## 2. Sources de vérité

- Supabase : source de vérité utilisée par l'application en production.
- Dépôt GitHub : source de vérité pour le schéma, les migrations, les scripts, le code et les règles métier.
- `package.json` : source de vérité de la version applicative.
- `CHANGELOG.md` : historique des changements par version.
- `docs/VERSIONING.md` : règles de versioning et de release.
- README et documents dans `docs/` : description fonctionnelle à maintenir avec le code.
- Google Sheets/CSV/XLSX : préparation et échange, jamais synchronisation implicite.

## 3. Avant toute modification

L'agent doit :

1. relever la version courante dans `package.json` ;
2. lire `CHANGELOG.md`, `VERSIONING.md` et les règles métier ;
3. identifier l'environnement : test ou production ;
4. identifier tables, fonctions, formulaires et scripts touchés ;
5. mesurer l'état avant changement : invitations, personnes, tables, invitations sans table, débordements et arrivées ;
6. préparer un aperçu exact des lignes ajoutées/modifiées/supprimées ;
7. obtenir l'autorisation explicite avant toute écriture en production ;
8. prévoir un retour arrière ;
9. déterminer l'impact de version.

## 4. État de référence v1.2.2

- 41 tables au total ;
- tables 1 à 40 normales ;
- table 41 seule réserve ;
- capacité officielle : 400 places ;
- capacité absolue : 410 places.

Ces chiffres décrivent la version 1.2.2 et doivent être changés uniquement avec une migration et une nouvelle entrée de changelog.

## 5. Identifiants

Les relations doivent continuer à utiliser les UUID (`event_id`, `table_id`, `invitation_id`, `guest_id`, `reserve_table_id`, `agent_id`). Le numéro visible d'une table n'est pas son identifiant technique.

## 6. Import Google Sheets, CSV ou XLSX

Avant un import : travailler sur une copie, préserver les identifiants, zéros initiaux et accents, détecter doublons/tables inexistantes/nombres invalides, et afficher un aperçu avant validation.

Un import ne doit jamais par défaut effacer les invitations absentes, remettre `nombre_arrive` à zéro, supprimer les membres, annuler les débordements, changer les UUID, supprimer l'audit ou écraser les modifications du jour J.

## 7. Formulaires

Pour chaque formulaire modifié, documenter champs, validations client/serveur, API, tables/fonctions Supabase, rôles, effets secondaires, concurrence et comportement réseau.

## 8. Règles essentielles

- Une invitation représente généralement un foyer ou un groupe.
- `nombre_prevu` est le nombre attendu; `nombre_arrive` le total enregistré.
- Déplacer une invitation conserve arrivées, membres et historique.
- Les membres détaillés sont optionnels.
- Une validation de check-in doit être atomique et auditée.
- Une table complète peut recevoir une affectation uniquement après confirmation explicite.
- Les tables de réserve ne sont pas les seules tables pouvant recevoir un débordement.
- Un débordement ne doit jamais être assigné deux fois.

## 9. Sécurité Supabase

- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` dans le navigateur, les logs, GitHub ou Google Sheets.
- Ne jamais placer une clé secrète dans une variable `NEXT_PUBLIC_*`.
- Ne jamais stocker les PIN de connexion dans Git, README, `docs/`, une PR ou un ticket.
- Vérifier RLS et autorisations serveur.
- Une information modifiable par l'utilisateur ne constitue jamais une preuve de rôle.

## 10. Migrations

Toute modification de schéma doit :

1. être réalisée dans une nouvelle migration versionnée ;
2. être réversible ou accompagnée d'une restauration ;
3. préserver les données existantes ;
4. être testée ;
5. être documentée dans la PR et `CHANGELOG.md` ;
6. entraîner un bump de version adapté selon `docs/VERSIONING.md`.

Ne jamais modifier manuellement la production puis oublier de reporter le changement dans GitHub.

## 11. Tests obligatoires

Tester les cinq rôles, les accès directs API, le réseau, la concurrence, la capacité, et lorsqu'une release touche auth/PWA : expiration de session, ancien déploiement et récupération vers le login.

## 12. Compte rendu obligatoire

À la fin, indiquer : ce qui a changé, pourquoi, version avant/après, tables/fonctions touchées, lignes affectées, contrôles, résultats, risques, rollback, migrations et documents mis à jour.

## 13. Interdictions sans autorisation

Ne jamais réinitialiser la production, vider une table, lancer un import destructif, modifier massivement les placements, réinitialiser les arrivées, changer les comptes/PIN, désactiver RLS, partager les clés Supabase ou fusionner une migration non vérifiée.
