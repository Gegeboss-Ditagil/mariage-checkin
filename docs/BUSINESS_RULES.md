# Règles métier — Check-in Mariage Nelly & Gersom

**Version documentaire : 1.75.0**
**Dernière mise à jour : 2026-10-08**

Ce document est la source de vérité fonctionnelle. Toute modification de rôle, navigation, formulaire, API ou donnée doit le respecter et l'ajuster dans le même lot/version.

## Plan de table et placement With Joy

- `/plan-table` est une vue de consultation accessible à tous les rôles autorisés à consulter les tables.
- `/admin/import-withjoy` est réservé à l'admin. Il produit d'abord un aperçu sans écriture; le remplacement complet est autorisé uniquement en mode Préparation/Test, après confirmation explicite, sauvegarde complète et contrôle de concurrence.
- Depuis le 23/08/2026, `/plan-table` propose un plan de salle interactif (bouton dédié, replié par défaut) : schéma SVG redessiné à partir des photos annotées de Gersom (`components/FloorPlan.tsx`), avec les 42 tables numérotées et cliquables — la réserve (42) a un emplacement défini. Le plan se zoome (pincement à deux doigts ou boutons +/−, `components/ZoomableFloorPlan.tsx`). Sélection bidirectionnelle purement côté client, sur les données déjà chargées — aucune nouvelle capacité, aucun nouvel appel réseau : appuyer sur une table du plan la surligne en vert et affiche sa fiche juste en dessous; le bouton 📍 sur une carte de la liste habituelle sélectionne la même table et fait défiler jusqu'au plan. Le clic normal sur une carte continue de naviguer vers `/tables/[tableId]`, inchangé.
- Certaines zones du plan (Bar, Buffets A/B, DJ et animation, Table staff — depuis v1.70.0 le plan reproduit exactement l'export seatplan.io, sans « Cuisine » ; le traiteur est rattaché aux deux Buffets, le photographe et les autres prestataires à la Table staff) sont également cliquables et affichent le personnel de catégorie `Staff` portant le tag correspondant (`Traiteur`, `Bar`, `DJ_Animation`, `Photographe` — tags déjà posés lors de l'import CSV, aucune nouvelle liste de rôles). Sélectionner une zone efface la table sélectionnée et inversement : un seul panneau s'affiche sous le plan à la fois.
- Depuis le 28/08/2026 (v1.19.0), `placement_status` reflète la confiance **RSVP**, pas le placement : `confirmee` seulement si CHAQUE membre du groupe a répondu par un texte commençant par « Oui » (le texte With Joy réel est « Oui, embarquement confirmé »), sinon `provisoire` (réponse « Peut-être », absence de réponse, ou aucune donnée RSVP disponible pour cette invitation). Un tag `F0xx`/`T0xx` explicite choisit toujours la table, mais ne rend plus `confirmee` à lui seul. `provisoire_reserve` reste dans le type/la contrainte pour compatibilité mais n'est plus jamais produit par l'import — la valeur « en réserve » se lit directement via `table_id` + `tables.is_reserve`, indépendamment de `placement_status`.
- **Depuis le 07/10/2026 (v1.72.0, migration `0066`, demande explicite de Gersom) : les tables 1 « Maquela do Zombo » et 42 sont les deux réserves « excédentaires » (vides, remplies dans cet ordre) ; les tables 2 à 41 sont normales et représentent 400 places officielles (capacité absolue 420).** La table 42, désactivée par `0064` le matin même, est réactivée (capacité 10) et redessinée sous la table 1 (PDF seatplan.io (8)).
- v1.68.2 (06/10/2026) : le schéma SVG interactif de `/plan-table` (`components/FloorPlan.tsx`) est repositionné selon le nouveau PDF seatplan.io (une seule grille de 6 colonnes × 8 rangées séparée par l'Allée centrale, au lieu des 4 zones cardinales de v1.68.0) — retour de Gersom : « most of the table that where in the south zone are now in the north zone and vice-versa ». Labels de zone simplifiés à 2 (Nord/Sud, au lieu de 4).
- `cote`, `tags` et `placement_status` expliquent le placement et ne modifient jamais les totaux de check-in.
- Toute réimportation doit suivre `docs/DATA_CHANGE_INSTRUCTIONS.md` et obtenir une autorisation explicite avant écriture en production.
- Les tags `Needs_Table_Gege`/`Needs_Table_Nelly` (export With Joy) signifient que Gege ou Nelly n'a pas encore assigné de table à la main : même traitement que `notable` (jamais d'auto-assignation via le pool aléatoire), sans être du staff. Un tag de table explicite reste prioritaire. Cette liste de personnes en attente reste modifiable directement dans l'application via les étiquettes et le transfert/échange en lot (voir sections ci-dessous), sans attendre un réimport.

## Réorganisation des tables (transfert/échange en lot)

- Depuis `/table/[tableId]` ou `/tables/[tableId]`, « Sélectionner plusieurs invités » fait apparaître une case à cocher par invitation (même capacité `moveGuests` que le déplacement individuel — pas de nouveau rôle).
- **Transférer** : les invitations sélectionnées sont déplacées ensemble vers une seule table de destination choisie ensuite (`move_invitations_table`, une ligne d'audit `invitation_move` par invitation, comme un déplacement individuel).
- **Échanger** : un groupe quitte la table A pour la table B pendant qu'un autre groupe quitte B pour A, dans la même transaction (`swap_invitations_between_tables`). Les deux groupes n'ont pas besoin de la même taille (ex. 2 personnes contre 4) — ce n'est pas un échange strictement 1 pour 1, seulement deux mouvements groupés exécutés ensemble.
- Comme le déplacement individuel, le lot n'est jamais bloqué par la capacité de la table (avertissement affiché, pas de blocage) : le placement pendant l'événement doit rester rapide, souvent provisoire, en attendant le placement final.
- Une invitation disparue entre-temps (déjà déplacée par quelqu'un d'autre) est ignorée dans le lot plutôt que de faire échouer tout le transfert/échange.
- Depuis le 30/08/2026 (v1.25.0), une **personne seule** d'un groupe peut aussi être déplacée individuellement (bouton ⇄ dans « Qui est arrivé ? », même capacité `moveGuests`) : elle est détachée dans une nouvelle invitation à une seule personne à la table choisie (`split_guest_to_new_invitation`), sans toucher au reste de son groupe d'origine. Pour la regrouper ensuite avec une invitation déjà présente à la table cible, utiliser « Fusionner avec un autre groupe » depuis la nouvelle fiche (voir section suivante) — pas de logique de fusion dupliquée.

## Renommer et fusionner des invitations

- Depuis `/checkin/[invitationId]`, « Renommer cette invitation » corrige le nom affiché (`nom_affichage`) sans toucher ni au nombre prévu, ni aux arrivées, ni à la table (`manageMembers` — même capacité que la page `/checkin/[invitationId]/members`, toujours fonctionnelle mais plus reliée depuis la fiche de check-in depuis la v1.38.0, voir plus bas). Utile pour un « Accompagnant non-nommé » identifié après coup. Réservée à `admin`/`directeur`/`placeur` depuis le 14/09/2026 — `agent_checkin` a perdu `manageMembers` (retour de Gersom : un agent scan ne doit pas pouvoir renommer un invité). Renommer un membre individuel depuis « Qui est arrivé ? » (`rename_invitation_member`) fait aussi suivre `nom_affichage` de l'invitation elle-même quand celle-ci n'a qu'un seul membre (invitation solo) — jamais pour un groupe, dont le libellé (« Famille X ») reste distinct de chacun de ses membres.
- « Fusionner avec un autre groupe » (`moveGuests` — même capacité que le déplacement de table) combine l'invitation courante dans une autre invitation choisie par recherche de nom : les nombres prévus/arrivés/supplémentaires s'additionnent, tout l'historique (checkins, débordements, membres détaillés, exceptions, audit) est rattaché à la cible avant que la source ne soit supprimée — rien n'est perdu.
- Fusionner deux invitations toutes les deux `category = 'Staff'` regroupe leur arrivée en une seule case à cocher, ce qui va à l'encontre de la règle d'individuation du staff : averti à l'écran, jamais bloqué (même principe que l'avertissement de capacité sur un déplacement de table) — à utiliser seulement pour corriger un import qui a séparé à tort deux membres d'un même foyer non-staff, pas pour regrouper deux vrais membres du staff.

## Étiquettes d'une invitation

- Depuis `/checkin/[invitationId]`, la section « 🏷️ Étiquettes » permet d'ajouter/retirer n'importe quelle étiquette (capacité dédiée `manageTags` — admin et directeur uniquement depuis v1.30.1, **ni placeur ni agent scan**, retiré le 23/08/2026 sur demande explicite de Gersom : ce rôle est là pour scanner/checker, pas pour reclassifier les invités), avec des raccourcis pour les étiquettes courantes : `Côté_Gege`, `Côté_Nelly`, `SERVICES` (Staff), `Photographe`, `Prestataire`, `DJ_Animation` (Animation) et `notable` (Sans table). But : pouvoir marquer sur place (photographe, prestataire, animation trouvés le jour J...) qui fait partie du staff, sans attendre un réimport CSV. `manageTags` était auparavant confondu avec `manageMembers` (renommer, gérer les membres du groupe) — `manageMembers` appartient à admin/directeur/placeur, `manageTags` à admin/directeur seulement ; agent scan n'a plus ni l'une ni l'autre depuis le 14/09/2026 (`manageMembers` retirée ce jour-là, `manageTags` déjà retirée le 23/08/2026).
- `Côté_Gege` et `Côté_Nelly` sont mutuellement exclusifs et synchronisent directement la colonne `cote` (comme à l'import With Joy) ; ajouter l'un retire automatiquement l'autre.
- Ajouter une étiquette de rôle (tout ce qui n'est ni un tag de table `Txxx`/`Fxxx` ni un tag « non-rôle » connu — `notable`, les tags de côté, SMS, cortège, etc. — voir `scripts/build_plan_from_csv.py`) place automatiquement l'invitation en `category = 'Staff'`, exactement comme à l'import. Retirer une étiquette de rôle ne repasse `category` à `null` que si c'était la **dernière** étiquette de rôle restante — jamais si l'invitation garde un autre rôle, pour ne pas désindividualiser silencieusement un vrai membre du staff.
- `notable` n'a aucun effet automatique sur `category` ou `cote` : il sert uniquement à afficher « Sans table » sur `/staff`, indépendamment du fait que l'invitation soit déjà `category = 'Staff'` ou non.
- Cette heuristique (SQL, `add_invitation_tag`/`remove_invitation_tag`) réplique volontairement celle du script d'import Python pour qu'une étiquette ajoutée à la main produise le même résultat qu'un réimport avec le même tag — si la liste des tags « non-rôle » change côté script, la reporter dans la migration SQL correspondante.

## Rôles

**Tableau vérifié ligne par ligne contre `lib/permissions.ts` le 07/10/2026 (v1.72.1)** — il contenait plusieurs lignes périmées (ajout d'invitation, renommage, étiquettes, agenda du placeur). Il est désormais verrouillé par `tests/qa-role-matrix.test.ts` : toute évolution de droits doit modifier le code, ce tableau et ce test dans le même lot. « Approbateur » = rôle technique `visibilite`, « Agent scanner » = `agent_checkin`.

| Capacité | Admin | Directeur | Placeur | Agent scanner | Approbateur |
|---|---:|---:|---:|---:|---:|
| Destination après connexion | Scan | Dashboard | Scan | Scan | Dashboard |
| Scanner un QR | Oui | Oui | Oui | Oui | Non |
| Rechercher et consulter tables/invités | Oui | Oui | Oui | Oui | Oui |
| Confirmer/corriger/annuler un check-in | Oui | Oui | Oui | Oui | Non |
| Marquer une absence (« ne viendra pas ») | Oui | Oui | Oui | Oui | Non |
| Renommer une invitation / gérer les membres du groupe | Oui | Oui | Oui | Non (depuis le 14/09/2026) | Non |
| Affecter un débordement pendant le check-in | Oui | Oui | Oui | Oui | Non |
| Déplacer un groupe ou une personne | Oui | Oui | Oui | Non | Non |
| Transférer/échanger plusieurs invitations en lot | Oui | Oui | Oui | Non | Non |
| Réorganiser un débordement déjà affecté | Oui | Oui | Oui | Non | Non |
| Ajouter une invitation (`/tables/add`, « + Invité ») | Oui | Oui (depuis le 02/09/2026) | Non | Non | Non |
| Voir les étiquettes déjà posées | Oui | Oui | Oui | Oui | Oui |
| Ajouter/retirer une étiquette | Oui | Oui (v1.30.1) | Non | Non | Non |
| Fusionner deux invitations | Oui | Non | Non | Non | Non |
| Appeler le staff (`/staff`, `/plan-table`) | Oui | Oui | Non | Non | Non |
| Envoyer un message WhatsApp/SMS au staff | Oui | Non | Non | Non | Non |
| Contacter un invité — appel/WhatsApp/SMS (`/search`) | Oui | Oui | Non | Non | Non |
| Utiliser l'écran Placement | Oui | Oui | Oui | Non | Non |
| Écran Staff (consultation + check-in) | Oui (tous) | Oui (tous) | Oui (sans table) | Oui (sans table) | Oui (tous, lecture seule) |
| Agenda du jour J (`/agenda`), lecture | Oui | Oui | Oui (depuis le 14/09/2026) | Oui (depuis le 03/09/2026) | Non |
| Agenda du jour J (`/agenda`), modification | Oui | Oui | Non | Non | Non |
| Historique (`/history`) | Oui | Non | Non | Non | Non |
| Exceptions | Oui | Oui | Oui | Oui | Non |
| Exporter les données | Oui | Non | Non | Non | Non |
| Panneau admin/import/comptes/configuration | Oui | Non | Non | Non | Non |
| Réinitialiser le mot de passe/PIN d'AUTRUI (`/mots-de-passe`) | Oui (sauf voir ci-dessous) | Oui (sauf admin) | Non | Non | Non |
| Modifier SON PROPRE mot de passe/PIN (`/mon-mot-de-passe`) | Oui | Oui | Oui | Oui | Oui |
| Invité surprise — prendre la photo et soumettre (`/scan`, `/checkin`) | Oui | Oui | Oui | Non (renvoie vers un placeur) | Non |
| Invité surprise — consulter les demandes (`/approbations`) | Oui | Oui | Oui | Oui (lecture) | Oui |
| Invité surprise — approuver/refuser dans l'app | Oui | Oui | Non | Non | Oui |
| Invité surprise — choisir/assigner la table | Oui | Oui | Oui | Non | Oui |
| Supprimer une demande d'invité surprise déjà décidée (`/approbations`) | Oui | Oui (depuis v1.57.0) | Oui (depuis v1.57.0) | Non | Non |

Depuis v1.72.1, les écrans d'écriture sous `/tables` exigent la capacité de leur action (et plus seulement le préfixe `/tables`) : `/tables/add` → ajout d'invitation, `/tables/move…`/`/tables/move-multiple`/`/tables/move-guest` → déplacement, `/tables/overflow` → réorganisation d'un débordement. Un rôle sans la capacité est renvoyé vers son écran d'arrivée, comme pour tout chemin hors matrice.

Depuis le 30/08/2026 (v1.26.0), `Historique` (`/history`, capacité `viewHistory`) est réservé à l'admin — demande explicite de Gersom, retiré du socle commun directeur/placeur/agent scan qui l'avaient jusque-là comme `Exceptions`. Un accès direct par URL pour un autre rôle est renvoyé vers l'écran par défaut de ce rôle par le middleware.

Depuis v1.31.1, `/agenda` est visible et modifiable avec `viewAgenda`/`manageAgenda` (`admin` et `directeur`). Nelly porte maintenant le rôle complet `directeur`, identique à Rémy, plutôt qu'une exception limitée à l'agenda. Heure, titre, département, détails, ordre, responsables et état terminé sont persistés dans `agenda_items`; les routes API revérifient chaque lecture et écriture côté serveur.

Depuis v1.67.1, un rôle avec `manageAgenda` doit explicitement toucher le bouton « Modifier » (haut de `/agenda`) pour entrer en mode édition avant qu'une carte ne redevienne tapable et que les boutons « + Ajouter une activité » n'apparaissent — en mode « Vue » (par défaut à chaque ouverture de la page), toucher une carte ne fait rien, seul le défilement fonctionne. Purement une protection d'interface côté client contre une classe de bugs de fiches modales ouvertes par inadvertance (voir v1.66.2) ; `manageAgenda` reste la seule vraie barrière de sécurité, revérifiée côté serveur à chaque écriture, inchangée.

Depuis v1.55.0, un élément d'agenda peut être marqué `is_private` (`agenda_items.is_private`, migration `0058`) — `GET /api/agenda` retire alors cette ligne de la réponse JSON pour tout rôle sans `manageAgenda` (agent scan, agent placeur) : un filtrage réel côté serveur, jamais un simple masquage visuel côté client. Aucune nouvelle capacité : la restriction réutilise `manageAgenda`, déjà réservée à `admin`/`directeur`.

Depuis v1.65.0 (03/10/2026), un écran dédié `/mots-de-passe` (capacité `managePasswords`, admin/directeur) permet de réinitialiser le PIN d'un autre compte en générant un code à 4 chiffres aléatoire — jamais une saisie manuelle, jamais consultable en clair une fois généré. La portée exacte (`lib/permissions.ts`, `canResetPassword`) : un admin ou un directeur « normal » peut réinitialiser n'importe quel compte **sauf un autre admin** ; un seul compte admin (`users.is_super_admin`, migration `0059`, confirmé explicitement par Gersom comme le compte « Admin » / gersomdos@gmail.com — son compte personnel « Dos » reste un admin ordinaire, séparation volontaire des pouvoirs) peut réinitialiser n'importe qui, y compris un autre admin, **et** consulter un indice anonymisé (`pin_reset_hint`, seulement les deux derniers chiffres, le reste en astérisques) du dernier code généré pour un compte — jamais le PIN réel ni une valeur réversible, uniquement pour rappeler un code déjà communiqué avant de réinitialiser pour de bon. `/admin/users` (création de compte, changement de rôle, édition libre du PIN/email/mot de passe) reste réservé à `role === 'admin'` (directeur n'y a jamais accès, `adminPanel` lui manque — `/mots-de-passe` reste donc sa SEULE porte d'entrée vers la réinitialisation). **Depuis v1.69.1**, le lien « 🔑 Mots de passe » du menu du compte (`components/AccountMenu.tsx`) n'est plus affiché pour `admin` (retour de Gersom : « doublon... deux clés dans ce menu-là ») — pour ce rôle, la fiche d'édition d'un compte sur `/admin/users` (bouton « Réinitialiser », v1.67.4) fait exactement la même chose ; `directeur` garde le lien, n'ayant aucun autre accès. La route `/mots-de-passe` elle-même, sa capacité `managePasswords` et `canResetPassword` restent entièrement inchangés — seule la visibilité du lien dans le menu change. Sur `/login`, un bouton « Mot de passe oublié ? » révèle un texte statique renvoyant vers un directeur de festin — aucun flux de réinitialisation en libre-service. Depuis v1.65.1, ce texte nomme explicitement Rémy Landu et Tuzola Saviera (demande de Gersom), plutôt que le terme générique « les directeurs de festin ».

Depuis v1.67.4 (retour de Gersom sur `/admin/users` : « on peut réinitialiser, on peut aussi modifier. On a le choix »), la fiche d'édition d'un compte sur `/admin/users` gagne elle aussi un bouton « Réinitialiser » (même route `POST /api/passwords`, même `canResetPassword`/`canViewPasswordHint` en seule source de vérité, gated par le `canReset`/`hint` désormais aussi renvoyés par `GET /api/admin/users`) — admin choisit directement, au même endroit, entre réinitialiser (code aléatoire généré) ou modifier manuellement (champ existant depuis toujours). Additif : `/mots-de-passe` reste entièrement inchangé et atteignable. **Bug réel trouvé et corrigé au passage** : `POST /api/passwords` écrivait toujours `pin_hash`, même pour une cible `admin` — un champ que la connexion admin (`email` + `password_hash`) ne lit jamais ; réinitialiser un admin (réservé à `is_super_admin`) affichait donc un « nouveau code » sans aucun effet réel sur sa connexion. Corrigé en branchant sur `target.role === 'admin'` pour écrire `password_hash` dans ce cas.

Depuis v1.69.0 (07/10/2026, retour de Gersom : « j'aimerais que les gens aient la possibilité de modifier leur mot de passe eux-mêmes »), un écran `/mon-mot-de-passe` (aucune capacité — ouvert à **tous** les rôles) permet à chaque compte de changer SON PROPRE secret, en reprouvant d'abord le secret **actuel** (`POST /api/account/password`, `verifySecret` avant tout changement — jamais une réinitialisation à l'aveugle comme `/mots-de-passe`). Lien « 🔑 Mon mot de passe » toujours visible dans le menu du compte, distinct du lien « 🔑 Mots de passe » (réservé à `managePasswords`, réinitialise le compte d'AUTRUI).

Depuis v1.69.0, `admin` et `directeur` peuvent aussi **contacter directement un invité** (capacité dédiée `contactGuests`, distincte de `callStaff`/`messageContacts` qui portent sur le STAFF) depuis `/search` : un bouton unique sur chaque ligne d'invité dont le téléphone est connu révèle le choix Appeler/WhatsApp/SMS (jamais un canal présélectionné), précédé d'un petit drapeau du pays déduit de l'indicatif international déjà stocké dans `invitations.telephone` (`lib/countries.ts`, `countryForPhone`/`flagEmoji` — aucune nouvelle donnée à importer, l'indicatif fait déjà partie du numéro tel que WithJoy l'exporte). `users.phone` (migration `0063`, nouvelle colonne nullable) stocke par ailleurs le téléphone du STAFF quand il est identifiable avec certitude par correspondance de nom avec `invitations.telephone` — purement une donnée de référence, jamais lue par la connexion elle-même.

Depuis v1.67.0 (03/10/2026), `POST /api/auth/login` verrouille un compte (les deux modes, `pin` et `password`) après **10 tentatives de connexion consécutives échouées** — voir `lib/loginLockout.ts`. Portée volontairement **par compte** (`nom_affichage`/`email`), jamais par adresse IP (éviterait de bloquer tout le staff partageant le même Wi-Fi de la salle). Verrouillage de **15 minutes**, confirmé explicitement par Gersom plutôt que deviné — un verrouillage permanent nécessitant une réinitialisation manuelle aurait risqué de bloquer durablement un agent distrait le jour du mariage. Le compteur se remet à zéro après une connexion réussie, ou tout seul une fois le verrouillage expiré (jamais un reverrouillage immédiat à la première tentative suivante). Un verrouillage déclenché est journalisé (`app_logs`, niveau `warn`, consultable sur `/admin/logs`) pour que Gersom puisse repérer une vraie tentative de sabotage, jamais seulement une erreur de saisie.

Depuis v1.40.0, `agent_checkin` a aussi `viewAgenda` (jamais `manageAgenda`) — retour de Gersom sur Agent001 : « il ne devrait pas voir en bas à droite staff... il devrait voir agenda à la place ». Ce rôle consulte donc le chronogramme sans le modifier ; `/staff` reste par ailleurs atteignable pour lui via le badge QR "STAFF" depuis `/scan` (`viewStaff` inchangée) — seul le raccourci permanent de la barre du bas remplace Staff par Agenda.

**Excédent placé en réserve (v1.73.0)** : la fiche d’une invitation n’affiche « Gérer l’excédent » que pour la part encore non placée, indique « ✓ N personne(s) placée(s) en réserve (table X) », et signale une place de réserve devenue inutile (arrivée annulée après le placement) avec « Libérer la place en réserve » pour les rôles `manageOverflow` (sinon : prévenir un placeur). Dans les calculs de capacité de l’application (`lib/capacity.ts`), cette personne compte à la table de réserve et n’est plus comptée en plus à la table d’origine.

**Santé de la base (v1.75.0)** : `/admin` affiche « Santé de la base » (`app_health_report`, lecture seule) — chaque fonction SQL appelée par l'application existe en une seule version, colonnes attendues présentes, et règles de données : lignes nominatives ≤ places, aucune table en surcapacité, aucun doublon de personne entre invitations, réserves = tables 1 et 42, aucune demande approuvée réservée sans table, compteur d'arrivées = personnes cochées. Tout échec d'une fonction SQL est journalisé dans `/admin/logs`.

**Réinitialisation des données de test (v1.75.0)** : refusée en mode « live ». Efface arrivées, excédents, exceptions et historique, remet chaque personne « arrivée » à « attendu » et retire les personnes ajoutées sur place ; les « ne viendra pas » et le placement sont conservés.

**Approbateur et fiches de check-in (v1.75.0)** : l'Approbateur (`visibilite`) n'ouvre jamais une fiche de check-in — les lignes de « Tous les invités » ne sont pas cliquables pour lui, placer un invité surprise le ramène à Approbations, et la flèche retour d'Approbations mène à sa page d'arrivée.

**Dessin des tables synchronisé (v1.74.0)** : le dessin d’une table (« Plan de la table · à jour en direct ») montre les personnes réellement placées à cette table — invitations de la table (lignes nominatives hors « ne viendra pas », sinon « Membres: », sinon le nom de l’invitation, complété par « Invité de … » jusqu’à `nombre_prevu`), moins leurs excédents envoyés en réserve, plus les excédents reçus (personne ajoutée sur place en premier, sinon « Excédent · <invitation> »). Les sièges du PDF seatplan.io gardent leur position pour les personnes toujours présentes ; les autres sont libérés ; les nouveaux prennent les premiers sièges libres, puis des sièges supplémentaires si la table déborde. Les chaises du grand plan suivent le même nombre (excédents compris). Affichage seulement : la source de placement reste `invitations.table_id`.

**Fiche d’invitation pour un scanneur (v1.73.1)** : à la première ouverture, la fiche crée les lignes nominatives manquantes (capacité `checkin`, scanneur compris) et affiche toujours « Qui est arrivé ? » (✓/✕ par personne) ; l’ancien compteur « Personnes arrivées » +/− n’est plus qu’un repli. Créer ces lignes ne modifie aucun total et ne permet pas de renommer (`manageMembers` inchangé).

**Recherche par nom (v1.73.0)** : chaque mot tapé doit être présent, dans n’importe quel ordre (« Makongo Roger » = « Roger Makongo ») ; un « e » tapé couvre aussi é/è/ê/ë (« Remy » trouve « Rémy ») ; « table 30 » trouve la table 30 ; une saisie sans lettre d’au moins 5 chiffres est cherchée comme numéro de téléphone (fin du numéro, tous formats).

**Lien public d’approbation (v1.73.0)** : le jeton secret de `/approve/[token]` et le téléphone de l’approbateur ne sont jamais renvoyés par l’API à l’application (création, réservation de table, décision) — seul l’approbateur reçoit le lien.

Depuis v1.30.1, `manageTags` est limité à `admin` et `directeur`; placeur et agent scan consultent seulement les étiquettes. Une liste nominative incomplète est réparée jusqu’à `max(nombre_prevu, nombre_arrive, 1)` sans changer ces compteurs. Un accompagnant ajouté à une invitation existante doit être nommé, hérite du côté du groupe et passe directement au placement de l’excédent.

## Invité surprise avec approbation SMS/WhatsApp à distance (v1.27.0)

- Navigation admin : Approbations est toujours dans le menu du compte. Elle apparaît aussi dans la barre du bas uniquement sur `/dashboard`, où Scan occupe le bouton central entre Recherche/Plan et Agenda/Approbations.
- **`placeur` calque le même comportement contextuel que `directeur`** (14/09/2026, retour de Gersom sur Agent001, rôle vérifié en base) : Tableau de bord au centre hors `/dashboard`, `/scan` et `/agenda` (Scan reste alors un onglet latéral), Scan/appareil photo au centre sur ces trois pages (Agenda + Bord ou Approbations en onglets latéraux selon la page), Approbations remplace Staff en dernier onglet de la barre générique. `placeur` gagne `viewAgenda` en lecture seule pour que l'onglet Agenda affiché lui reste accessible (jamais `manageAgenda`, réservée à admin/directeur). `/staff` reste atteignable via le badge QR "STAFF" depuis `/scan` (`viewStaff` inchangée).
- **`agent_checkin` rejoint à son tour ce même comportement contextuel**, même jour (retour de Gersom sur Scotty Sanda : le bouton doré du bas doit être Scan, pas un aller-retour vers Bord, une fois déjà sur `/dashboard`) : Scan (jamais l'appareil photo, ce rôle n'a pas `submitGuestApproval`) au centre sur `/dashboard`/`/scan`/`/agenda`, Bord au centre partout ailleurs — barre générique inchangée sinon.

Depuis le 30/08/2026, un placeur, un directeur de festin ou l'admin peut gérer un invité non prévu directement depuis `/scan`, avec une approbation à distance **avant** de le laisser entrer — capacité dédiée `guestApproval` (jamais agent scan ni visibilité : « si le scanner voit des personnes en plus, il ne fait rien, il va voir le placeur directement », demande explicite de Gersom).

**Twilio (SMS + WhatsApp ci-dessous) est désactivé par défaut** — retour de Gersom le 14/09/2026 : « c'est toggle off... on activera plus tard ». Tant que désactivé, aucune requête réseau Twilio n'est même tentée (ni SMS ni WhatsApp, dans un sens comme dans l'autre) : la demande d'invité surprise, la décision (approuver/refuser/reconsidérer) et l'assignation de table restent entièrement fonctionnelles dans l'application elle-même (créées et décidées uniquement depuis `/scan`/`/approbations`, jamais par SMS/WhatsApp/lien public tant que désactivé) — seule la notification externe à l'approbateur et le rapport au directeur de festin ne partent pas, et l'agent qui soumet une demande ne voit alors aucun message à ce sujet (v1.53.2 : ce n'est pas un problème tant que c'est volontaire). **v1.53.2 (16/09/2026) : le bouton bascule « SMS/WhatsApp (Twilio) » sur `/admin` active/désactive directement `events.twilio_enabled` (migration `0055`)** — remplace l'ancien interrupteur par variable d'environnement `TWILIO_ENABLED` (v1.48.3), qui nécessitait un accès Vercel. Les identifiants `TWILIO_*` restent nécessaires sur Vercel pour un envoi réel — voir `DEPLOIEMENT.md`.

- **Photo** (une seule prise, appareil photo natif) → **côté** (Nelly/Gégé) → **nom + nombre d'invités** → la demande est enregistrée et un SMS **et** un message WhatsApp partent en parallèle vers l'approbateur configuré pour ce côté (`guest_approvers` : « Mon Papa » pour le côté Gégé, « Papa David » pour le côté Nelly — table de configuration, pas des numéros codés en dur, modifiable depuis Supabase sans redéploiement). Le double canal existe « au cas où [l'approbateur] n'a pas de réseau [cellulaire] et est connecté au wifi » (WhatsApp passe par data/wifi) — chacun est best-effort, l'échec de l'un (WhatsApp tant que son Content Template n'est pas encore approuvé côté Twilio/Meta) ne bloque jamais l'autre.
- Ni le SMS ni le WhatsApp ne contiennent **jamais la photo elle-même** (un numéro Twilio français ne supporte pas les MMS ; un message WhatsApp initié par l'app doit rester dans son Content Template pré-approuvé, pas de média possible) — uniquement un lien vers `/approve/[token]`, une page **publique** (sans connexion) qui l'affiche à l'ouverture.
- **Deux façons de décider**, une seule logique atomique derrière : cliquer Approuver/Refuser sur `/approve/[token]`, **ou répondre directement « Oui »/« O »/« Y » ou « Non »/« N » au message WhatsApp** (pas besoin de cliquer le lien pour décider, seulement pour voir la photo). Un seul clic/une seule réponse possible : la demande est invalidée pour tout usage futur dès la première décision (une seconde tentative affiche « déjà traité », jamais une erreur technique) — le canal utilisé est conservé (`decided_via`).
- Une fois **approuvée**, la demande apparaît dans `/approbations` (écran dédié, même capacité `submitGuestApproval`/`reviewGuestApproval`). Depuis le 02/09/2026 (v1.34.0), l'ajout à la liste des invités et le placement sont **automatiques à l'approbation** (`auto_assign_table_for_guest_approval`, 0045/0046/0056) — plus besoin de choisir une table au préalable : (0) la table du groupe avec qui la personne est arrivée si la demande y est liée et qu'elle a de la place, sinon (1) **depuis le 16/09/2026 (v1.53.12)** la table normale la plus libre du même côté, sinon (2) la table excédentaire/réserve (quel que soit le côté — reprenait la priorité 1 avant ce changement), sinon (3) n'importe quelle autre table normale (côté opposé inclus), sinon la demande reste approuvée sans table (jamais de double booking silencieux, un placeur/directeur assigne alors manuellement). Cette étape crée l'invitation correspondante, mais ne la marque **pas** arrivée : le check-in se fait ensuite normalement depuis sa fiche, comme pour n'importe quel invité.
- **Invité surprise lié à un groupe déjà invité** (`linked_invitation_id`, 0046, v1.34.0) : depuis `/checkin/[invitationId]`, un placeur/directeur/admin (capacité `submitGuestApproval` — jamais `agent_checkin`) peut démarrer une demande d'approbation pour une personne arrivée avec le groupe affiché sur la fiche courante. Le côté est préempli depuis l'invitation (modifiable), la personne prend une photo, le nom est saisi, puis la demande suit exactement le même circuit d'approbation que depuis `/scan`. **Depuis la v1.38.0**, l'ajout instantané sans photo (l'ancien bouton autonome « + Non prévu », jugement du staff, sans approbation) n'est plus un bouton séparé sur cette page : il vit désormais dans le "+" de « Qui est arrivé ? » (`GuestArrivalPanel`, même capacité `submitGuestApproval`) — la personne y est ajoutée nommée et marquée arrivée immédiatement (`add_unplanned_arrival`), avec le même déclenchement de l'excédent. Les deux mécanismes (ajout instantané et photo/approbation) coexistent toujours, réservés au même rôle, simplement regroupés différemment sur l'écran.
- **`checkin` seul ne suffit plus pour ajouter un invité non prévu** (v1.34.0) : cette action exige désormais `submitGuestApproval`, la même capacité que `/scan` et le nouveau parcours lié — « si les scanners scannent, vous dites vous êtes quatre mais dans l'invitation il y a deux, ils ne vont même pas traiter votre demande... c'est les placeurs qui vont gérer le reste, car ils auront les bons accès » (demande explicite de Gersom). Le check-in normal (marquer présents des invités déjà prévus, `set-arrival-status`) reste inchangé pour tous les rôles avec `checkin`, `agent_checkin` inclus.
- **Un accompagnant ajouté ainsi (`add_unplanned_arrival`) ne compte jamais dans `nombre_prevu`, même après un aller-retour de statut** (v1.40.0, `guests.is_unplanned`, migration `0048`) : le marquer "ne viendra pas" puis "attendu" dans « Qui est arrivé ? » ne fait bouger que `nombre_arrive`, jamais `nombre_prevu` — bug trouvé par Gersom où `nombre_prevu` retombait à 0 après plusieurs de ces allers-retours, `set_guest_arrival_status` décrémentant à tort les places prévues d'un accompagnant qui n'y avait jamais été compté. Le déplacer individuellement vers une autre table (`split_guest_to_new_invitation`) conserve la même règle : sa nouvelle fiche reste "0 prévue" plutôt que de silencieusement devenir "prévue" au passage.
- Dans l'application, `admin`, `directeur` et `visibilite` peuvent approuver/refuser puis choisir la table ; le `placeur` conserve aussi l'assignation. Par SMS/WhatsApp ou lien public, la décision reste strictement Oui/Non : aucune table ne peut être transmise par ces canaux.
- **Reconsidérer un refus** (v1.43.0, `allowReconsiderFromRefused`, uniquement depuis l'application — jamais `/approve/[token]` ni WhatsApp, et jamais l'inverse : une approbation peut déjà avoir une table assignée) mène désormais d'abord au **choix d'une table** (v1.44.0) avant l'approbation, sur `/approbations/[id]/assign` (mode `reconsider`, mêmes capacités `reviewGuestApproval` + `assignGuestApproval`) — auparavant l'approbation était immédiate et le placement automatique choisissait seul la table, sans intervention possible.
- Toute assignation respecte strictement la capacité de la table. Si elle est insuffisante, l'approbateur doit choisir des invitations non arrivées à déplacer et une destination capable de les recevoir. Une invitation dont `nombre_arrive > 0` est considérée déjà arrivée/assise et ne peut jamais être déplacée. Assignation et réorganisation réussissent ou échouent ensemble dans une transaction atomique.
- Une approbation déclenche un Push best-effort à tous les `placeur` abonnés : lien d'assignation si aucune table n'est encore choisie, puis confirmation de la table après placement.
- Après une approbation dans l'application, l'approbateur choisit explicitement « Choisir la table moi-même » ou « Laisser le placeur l'assigner ». Le second choix ne crée pas un nouvel état : la demande reste `approuve` avec `table_id = null`, donc visible et assignable par le placeur.
- Après approbation, l'approbateur reçoit une confirmation indiquant combien de places de réserve il reste. Après assignation de table, un SMS de rapport part vers le directeur de festin (table `festin_directors` : nom de l'approbateur qui a validé, nombre de places, table assignée, places de réserve restantes) — pré-remplie avec Rémy Landu et Tuzola (`0033_festin_directors_contacts.sql`) ; reste un no-op silencieux (aucune erreur ni blocage) si cette table venait à être vidée.

## Comptes de connexion

Cette liste documente uniquement les **noms à saisir** et les rôles opérationnels. Les PIN sont des secrets d'authentification : ils ne doivent jamais être écrits dans README, `docs/`, Git, une PR, un ticket ou un message collectif. Ils sont gérés par un admin depuis `/admin/users` et stockés dans Supabase.

### Admins

- Admin
- Dos

### Directeurs de festin

- Rémy
- Tuzola
- Sem

### Agent placeur — la mariée

- Nelly Dos

### Visibilité — lecture seule

- Papa
- David

### Staff — agents placeurs

- Wandubula
- Ribeiro
- Shungu
- Muzezenu
- Shampe
- Onokoko
- Lotisi
- Damuna
- Kambwa
- Luyindula
- Lopez
- Landu
- Sanda
- Placeur014 (réserve)
- Placeur015 (réserve)
- Placeur016 (réserve)

### Agents scan — comptes génériques en réserve

- Agent001 à Agent016

Les comptes génériques peuvent être renommés depuis `/admin/users` au fur et à mesure que l'équipe est confirmée. Les anciens comptes de test restent désactivés. Chaque PIN doit être transmis individuellement à son détenteur, jamais avec la liste complète des comptes.

## Staff

- Une invitation `category = 'Staff'` marque une personne du staff/prestataire, indépendamment de son affectation à une table.
- `/staff` (route ET badge QR `STAFF` depuis `/scan`) est accessible à tous les rôles scannants (admin, directeur, placeur, agent scan) en plus de visibilité en lecture seule.
- **Corrigé le 23/08/2026 : `/staff` affiche par défaut uniquement le personnel sans table** (tag `notable` — photographe, DJ, MC, prestataires…). Le reste du staff (avec table) est déjà compté comme invité normal et arrive avec sa famille ou son groupe. Objectif : conserver une liste opérationnelle courte pour l'entrée.
- **Ajouté le 23/08/2026 : onglets « Sans table » / « Avec table »**, visibles uniquement pour admin, directeur et visibilité (`viewAllStaff`). Placeur et agent scan restent sur la seule liste sans table, sans onglet. La page consomme exclusivement `GET /api/staff`; le serveur vérifie la session signée et ne transmet les lignes avec table qu'aux rôles possédant `viewAllStaff`. Les actualisations périodiques et au retour au premier plan repassent par cette API protégée, sans souscription Supabase directe depuis le navigateur.
- Une barre de recherche par nom/téléphone est disponible sur `/staff` pour retrouver rapidement une personne dans la liste.
- Chaque ligne affiche un bouton d'appel direct (`tel:`) quand un numéro est enregistré, pour joindre la personne sans devoir d'abord ouvrir son check-in.
- Le tag de rôle staff (`SERVICES` ou autre tag de rôle) est individuel : si un seul membre d'un foyer le porte, seule cette personne est `category = 'Staff'` (isolée dans sa propre invitation), jamais tout le foyer.
- La section Staff du tableau de bord (`/dashboard`, réservée à admin/directeur/visibilité) reste une vue d'ensemble distincte : elle compte TOUT le staff (avec et sans table), pour le suivi global — différente de la liste opérationnelle `/staff` qui, elle, ne montre que le personnel sans table à contrôler à l'entrée.
- Un tag `notable` signale un membre du staff volontairement sans table. Lors d'un futur import, un tag de table explicite reste prioritaire et produit un avertissement.

## Principes

- Voir une invitation, effectuer son check-in et la déplacer sont trois permissions distinctes.
- Masquer un bouton ne suffit jamais : chaque route API vérifie aussi le rôle côté serveur.
- Le rôle visibilité est strictement en lecture seule et ne doit jamais afficher une caméra.
- Les écritures nécessitent une connexion. Aucun check-in hors ligne n'est mis en file d'attente.
- Une invitation représente un foyer ou groupe; les membres détaillés restent optionnels.
- Les opérations concurrentes doivent être atomiques, historisées et synchronisées en temps réel.
- Une table affichée complète exige une confirmation explicite avant affectation exceptionnelle.
- Les exports, imports et comptes sont administratifs. La lecture des QR (scan) reste ouverte aux rôles scannants; leur association à une table se fait désormais directement en base, l'admin n'ayant plus d'écran dédié pour cela.
- Une session applicative expire au plus tard après 12 h.
- **(v1.53.19)** Un déploiement n'invalide plus une session active — seule l'expiration naturelle (12 h) ou un changement du format du payload (`SESSION_SCHEMA_VERSION`, incrémenté à la main uniquement quand ce format change réellement) la termine. Avant cette version, chaque déploiement (même sans rapport avec les sessions) déconnectait tout le monde instantanément — cause principale d'un signalement de déconnexions fréquentes en navigation.

## Données et capacité

- Les listes détaillées de `/dashboard` répartissent les personnes par côté Nelly/Gégé. Le total représente les arrivés pour la liste « Arrivés », les personnes encore attendues pour « Restants », l'excédent réel pour « Supplémentaires » et le nombre prévu pour les autres listes.

- `nombre_prevu` est le nombre attendu; `nombre_arrive` est le total enregistré.
- Pour un groupe (`nombre_prevu > 1`), l'arrivée se suit PAR PERSONNE (`guests.arrival_status` : `attendu`/`arrive`/`ne_viendra_pas`), pas via un simple compteur — voir `CHANGELOG.md` v1.21.0. `nombre_arrive`/`nombre_prevu` restent les totaux dérivés, recalculés à chaque bascule d'une personne (`set_guest_arrival_status`), jamais modifiés directement. Une personne marquée `ne_viendra_pas` reste visible (grisée) et reversible, jamais supprimée. Une invitation solo (`nombre_prevu <= 1`) garde le compteur +/- classique — cas non ambigu.
- Retirer un membre diminue `nombre_prevu`; le renommer ne le modifie pas.
- Lors de la toute première création de la liste détaillée, retirer une ligne du brouillon puis enregistrer diminue également `nombre_prevu` au nombre de membres effectivement sauvegardés. Cette initialisation ne peut jamais augmenter `nombre_prevu`; un ajout passe par l'action dédiée « Ajouter une personne ».
- Déplacer une invitation conserve ses arrivées, membres et historique.
- Un débordement ne doit jamais être assigné deux fois.
- Capacité physique, places libres maintenant et occupation estimée sont des mesures différentes.
