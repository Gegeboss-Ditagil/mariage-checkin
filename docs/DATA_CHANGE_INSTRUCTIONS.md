# Instructions pour les modifications de données

**Version documentaire : 1.68.1**
**Dernière mise à jour : 2026-10-05**

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

## 4. État de référence v1.68.0 (mis à jour depuis v1.47.0)

- 41 tables au total (plan de table final seatplan.io, 05/10/2026) ;
- tables 1 à 40 normales ;
- table 41 seule réserve « excédentaire » (redevenue réserve — retour sur v1.47.0, où elle était régulière) ;
- capacité officielle : 400 places ;
- capacité absolue : 410 places ;
- la table 42 (« Johannesburg ») n'existe plus dans ce plan — décommissionnée (`capacity = 0`, `is_reserve = false`) plutôt que supprimée, pour préserver 13 références historiques dans `audit_logs.table_id` (voir migration `0061`).

Ces chiffres décrivent la version 1.68.0 et doivent être changés uniquement avec une migration et une nouvelle entrée de changelog.

## 5. Identifiants

Les relations doivent continuer à utiliser les UUID (`event_id`, `table_id`, `invitation_id`, `guest_id`, `reserve_table_id`, `agent_id`). Le numéro visible d'une table n'est pas son identifiant technique.

## 6. Import Google Sheets, CSV ou XLSX

Avant un import : travailler sur une copie, préserver les identifiants, zéros initiaux et accents, détecter doublons/tables inexistantes/nombres invalides, et afficher un aperçu avant validation.

L'import complet `/admin/import-withjoy` constitue l'exception explicitement destructive réservée aux phases Préparation/Test : double confirmation, sauvegarde complète, transaction atomique et refus si l'état a changé depuis l'aperçu. Son utilisation en production reste soumise à l'autorisation explicite de Gersom.

**Depuis la migration `0026_import_replace_invitations` (v1.15.0, corrigée en v1.15.1) : `/admin/import-withjoy` (RPC `admin_replace_invitations`) est le chemin de référence pour tout futur réimport complet**, plutôt que la transcription manuelle de SQL en `apply_migration` (utilisée pour les réimports `guestlist_20`/`24`/`25` du 22-23/08/2026, avant que ce chemin n'existe). La RPC gère elle-même : sauvegarde privée complète dans `import_backups` (RLS activée, jamais lisible par `anon`/`authenticated`, uniquement `service_role`), contrôle de concurrence par empreinte (`admin_import_invitations_state`), transaction atomique, validation ligne par ligne et journal d'audit. Ne jamais réappliquer cette migration ni recréer ses objets manuellement.

**Depuis le 25/08/2026 (atelier famille) : With Joy n'est plus la source de vérité des tables/placements.** La famille corrige directement un tableur (Google Sheet, dérivé de l'export `/plan-table` : table, invitation, nombre de personnes, noms, côté) lors d'ateliers de réorganisation ; ce tableur devient la source de vérité pour l'affectation des tables et le regroupement des invitations. With Joy reste la source de vérité pour les coordonnées de contact (téléphone, email) uniquement — un CSV au format With Joy est régénéré depuis Supabase pour resynchroniser ces contacts après chaque correction, mais son contenu de placement n'est plus réimporté automatiquement : la correspondance entre le tableur et l'état précédent se fait par nom (individu par individu quand un groupe est réorganisé), avec recherche exacte puis approchée, et tout nom sans correspondance ou tout doublon de nom entre deux tables doit être signalé explicitement plutôt que deviné silencieusement.

Un import ne doit jamais par défaut effacer les invitations absentes, remettre `nombre_arrive` à zéro, supprimer les membres, annuler les débordements, changer les UUID, supprimer l'audit ou écraser les modifications du jour J.

**15/09/2026 : premier remplacement complet réellement exécuté en production** (`guest-list_56.csv`, sur autorisation explicite de Gersom — « le CSV final... écrase ce qui est dans l'app »), a révélé deux bugs jamais déclenchés avant faute d'un vrai essai : `guest_approval_requests.linked_invitation_id` bloquait le `delete from invitations` (FK sans `ON DELETE`, corrigé par la migration `0054`) et `lib/withjoyImport.ts` ne retirait pas une apostrophe de tableur parfois présente devant le numéro de téléphone (corrigé, `cleanPhone`). Voir CHANGELOG v1.52.0.

**15/09/2026 (v1.53.0) : `/admin/import` (import CSV/XLSX générique par association manuelle de colonnes) supprimé** sur demande explicite de Gersom (« on va seulement garder les imports à partir du CSV de Witjoy pour simplifier les éléments »). `/admin/import-withjoy` (RPC `admin_replace_invitations`, section 6 ci-dessus) reste donc l'unique chemin d'import d'invitations dans l'application — aucun changement à ce chemin ni à ses garanties (aperçu, double confirmation, sauvegarde, transaction atomique).

**05/10/2026 (v1.68.0) : plan de table final (4 photos de zones seatplan.io + CSV `guest-list_57.csv`), mise à jour ciblée plutôt qu'un remplacement complet.** Une première analyse avait recommandé `/admin/import-withjoy` (remplacement complet) — corrigée avant toute écriture en relisant cette même section : depuis le 25/08/2026, une correspondance par nom (`withjoy_party_id` stable en priorité, nom exact en repli) est la méthode sanctionnée pour une réorganisation de placement, pas un remplacement destructif. 38 des 261 invitations ont vu leur `table_id` modifié (23 nouvelle table, 15 sans table dont 9 marquées `ne_viendra_pas = true` sur confirmation explicite de Gersom — personnes absentes par nom du nouveau CSV). Plusieurs écarts signalés plutôt que devinés (groupe à scinder entre deux tables, composition de groupe divergente du CSV) : voir CHANGELOG v1.68.0 pour le détail complet.

**05/10/2026 (v1.68.1) : confirmation + corrections depuis le PDF export seatplan.io final (vectoriel), suite directe de v1.68.0.** Un signalement initial (capture d'écran partielle montrant la table 41 occupée) a été clarifié avant toute action — demande explicite de confirmation du périmètre (nombre de tables vs nouvelle source complète), conformément à la section 3. Le PDF complet reçu ensuite confirme la structure déjà livrée en v1.68.0 (41 tables, aucune table 42) ; aucune migration nécessaire. Texte extrait directement du PDF vectoriel (coordonnées + police, via PyMuPDF) plutôt qu'une OCR de photos — méthode plus fiable, recoupée avec les invitations en base pour l'orthographe canonique, comme toujours. 4 corrections de placement par correspondance de nom (jamais un remplacement complet) : Erika Dos Goncalves (table 2 → 1) ; Famille Tusevo (sans table → table 7, composition corrigée à 3 membres réels) ; Famille Malungu scindée (Sister 2 + Keziah → table 32) ; le reste de ce groupe (Ruben Kinanga Malungu, Maguy Malungu, Sister 1 Malungu) laissé **sans table**, un conflit de capacité (table 2 déjà pleine avec l'invité surprise « Cedrix », hors CSV) signalé à Gersom plutôt que la table surchargée silencieusement. Capacité vérifiée après coup : 0 table en surcapacité. Voir CHANGELOG v1.68.1 pour le détail complet, incluant les personnes nouvelles trouvées dans le PDF mais non ajoutées (signalées, pas devinées).

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
