# Règles métier — Check-in Mariage Nelly & Gersom

**Version documentaire : 1.31.0**
**Dernière mise à jour : 2026-08-31**

Ce document est la source de vérité fonctionnelle. Toute modification de rôle, navigation, formulaire, API ou donnée doit le respecter et l'ajuster dans le même lot/version.

## Plan de table et placement With Joy

- `/plan-table` est une vue de consultation accessible à tous les rôles autorisés à consulter les tables.
- `/admin/import-withjoy` est réservé à l'admin. Il produit d'abord un aperçu sans écriture; le remplacement complet est autorisé uniquement en mode Préparation/Test, après confirmation explicite, sauvegarde complète et contrôle de concurrence.
- Depuis le 23/08/2026, `/plan-table` propose un plan de salle interactif (bouton dédié, replié par défaut) : schéma SVG redessiné à partir des photos annotées de Gersom (`components/FloorPlan.tsx`), avec les 41 tables numérotées et cliquables — la réserve (41) a désormais un emplacement défini (confirmé par Gersom le 23/08/2026; avant cette date elle n'apparaissait pas sur le plan). Le plan se zoome (pincement à deux doigts ou boutons +/−, `components/ZoomableFloorPlan.tsx`). Sélection bidirectionnelle purement côté client, sur les données déjà chargées — aucune nouvelle capacité, aucun nouvel appel réseau : appuyer sur une table du plan la surligne en vert et affiche sa fiche juste en dessous; le bouton 📍 sur une carte de la liste habituelle sélectionne la même table et fait défiler jusqu'au plan. Le clic normal sur une carte continue de naviguer vers `/tables/[tableId]`, inchangé.
- Certaines zones du plan (Cuisine, Bar, DJ et animation, Prestataires & staff) sont également cliquables et affichent le personnel de catégorie `Staff` portant le tag correspondant (`Traiteur`, `Bar`, `DJ_Animation`, `Photographe` — tags déjà posés lors de l'import CSV, aucune nouvelle liste de rôles). Sélectionner une zone efface la table sélectionnée et inversement : un seul panneau s'affiche sous le plan à la fois.
- Depuis le 28/08/2026 (v1.19.0), `placement_status` reflète la confiance **RSVP**, pas le placement : `confirmee` seulement si CHAQUE membre du groupe a répondu par un texte commençant par « Oui » (le texte With Joy réel est « Oui, embarquement confirmé »), sinon `provisoire` (réponse « Peut-être », absence de réponse, ou aucune donnée RSVP disponible pour cette invitation). Un tag `F0xx`/`T0xx` explicite choisit toujours la table, mais ne rend plus `confirmee` à lui seul. `provisoire_reserve` reste dans le type/la contrainte pour compatibilité mais n'est plus jamais produit par l'import — la valeur « en réserve » se lit directement via `table_id` + `tables.is_reserve`, indépendamment de `placement_status`.
- Les tables 1 à 40 sont normales et représentent 400 places officielles.
- La table 41 est l'unique table de réserve; la capacité absolue est donc 410 places.
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

- Depuis `/checkin/[invitationId]`, « Renommer cette invitation » corrige le nom affiché (`nom_affichage`) sans toucher ni au nombre prévu, ni aux arrivées, ni à la table (`manageMembers` — même capacité que « Gérer les membres du groupe »). Utile pour un « Accompagnant non-nommé » identifié après coup.
- « Fusionner avec un autre groupe » (`moveGuests` — même capacité que le déplacement de table) combine l'invitation courante dans une autre invitation choisie par recherche de nom : les nombres prévus/arrivés/supplémentaires s'additionnent, tout l'historique (checkins, débordements, membres détaillés, exceptions, audit) est rattaché à la cible avant que la source ne soit supprimée — rien n'est perdu.
- Fusionner deux invitations toutes les deux `category = 'Staff'` regroupe leur arrivée en une seule case à cocher, ce qui va à l'encontre de la règle d'individuation du staff : averti à l'écran, jamais bloqué (même principe que l'avertissement de capacité sur un déplacement de table) — à utiliser seulement pour corriger un import qui a séparé à tort deux membres d'un même foyer non-staff, pas pour regrouper deux vrais membres du staff.

## Étiquettes d'une invitation

- Depuis `/checkin/[invitationId]`, la section « 🏷️ Étiquettes » permet d'ajouter/retirer n'importe quelle étiquette (capacité dédiée `manageTags` — admin, directeur, placeur; **pas agent scan**, retiré le 23/08/2026 sur demande explicite de Gersom : ce rôle est là pour scanner/checker, pas pour reclassifier les invités), avec des raccourcis pour les étiquettes courantes : `Côté_Gege`, `Côté_Nelly`, `SERVICES` (Staff), `Photographe`, `Prestataire`, `DJ_Animation` (Animation) et `notable` (Sans table). But : pouvoir marquer sur place (photographe, prestataire, animation trouvés le jour J...) qui fait partie du staff, sans attendre un réimport CSV. `manageTags` était auparavant confondu avec `manageMembers` (renommer, gérer les membres du groupe) — les deux capacités restent identiques pour admin/directeur/placeur, mais divergent désormais pour agent scan qui garde `manageMembers` sans `manageTags`.
- `Côté_Gege` et `Côté_Nelly` sont mutuellement exclusifs et synchronisent directement la colonne `cote` (comme à l'import With Joy) ; ajouter l'un retire automatiquement l'autre.
- Ajouter une étiquette de rôle (tout ce qui n'est ni un tag de table `Txxx`/`Fxxx` ni un tag « non-rôle » connu — `notable`, les tags de côté, SMS, cortège, etc. — voir `scripts/build_plan_from_csv.py`) place automatiquement l'invitation en `category = 'Staff'`, exactement comme à l'import. Retirer une étiquette de rôle ne repasse `category` à `null` que si c'était la **dernière** étiquette de rôle restante — jamais si l'invitation garde un autre rôle, pour ne pas désindividualiser silencieusement un vrai membre du staff.
- `notable` n'a aucun effet automatique sur `category` ou `cote` : il sert uniquement à afficher « Sans table » sur `/staff`, indépendamment du fait que l'invitation soit déjà `category = 'Staff'` ou non.
- Cette heuristique (SQL, `add_invitation_tag`/`remove_invitation_tag`) réplique volontairement celle du script d'import Python pour qu'une étiquette ajoutée à la main produise le même résultat qu'un réimport avec le même tag — si la liste des tags « non-rôle » change côté script, la reporter dans la migration SQL correspondante.

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
| Transférer/échanger plusieurs invitations en lot | Oui | Oui | Oui | Non | Non |
| Réorganiser un débordement déjà affecté | Oui | Oui | Oui | Non | Non |
| Ajouter une invitation individuelle | Oui | Non | Non | Non | Non |
| Renommer une invitation | Oui | Oui | Oui | Oui | Non |
| Voir les étiquettes déjà posées | Oui | Oui | Oui | Oui | Oui |
| Ajouter/retirer une étiquette | Oui | Non | Non | Non | Non |
| Fusionner deux invitations | Oui | Non | Non | Non | Non |
| Envoyer un message WhatsApp/SMS | Oui | Non | Non | Non | Non |
| Utiliser l'écran Placement | Oui | Oui | Oui | Non | Non |
| Écran Staff (consultation + check-in) | Oui | Oui | Oui | Oui | Oui (lecture seule) |
| Agenda du jour J (`/agenda`) | Oui | Oui | Non | Non | Non |
| Historique (`/history`) | Oui | Non | Non | Non | Non |
| Exceptions | Oui | Oui | Oui | Oui | Non |
| Exporter les données | Oui | Non | Non | Non | Non |
| Panneau admin/import/comptes/configuration | Oui | Non | Non | Non | Non |
| Invité surprise (photo + approbation SMS/WhatsApp, `/scan`, `/approbations`) | Oui | Oui | Oui | Non | Non |

Depuis le 30/08/2026 (v1.26.0), `Historique` (`/history`, capacité `viewHistory`) est réservé à l'admin — demande explicite de Gersom, retiré du socle commun directeur/placeur/agent scan qui l'avaient jusque-là comme `Exceptions`. Un accès direct par URL pour un autre rôle est renvoyé vers l'écran par défaut de ce rôle par le middleware.

Depuis v1.31.0, `/agenda` est visible et modifiable avec `viewAgenda`/`manageAgenda` (`admin` et `directeur`) ou avec l'exception nominative privée `users.agenda_manager` (Nelly, qui conserve son rôle `placeur`). Cette exception ne donne aucun droit aux autres placeurs. Heure, titre, département, détails, ordre, responsables et état terminé sont persistés dans `agenda_items`; les routes API revérifient chaque lecture et écriture côté serveur.

Depuis v1.30.1, `manageTags` est limité à `admin` et `directeur`; placeur et agent scan consultent seulement les étiquettes. Une liste nominative incomplète est réparée jusqu’à `max(nombre_prevu, nombre_arrive, 1)` sans changer ces compteurs. Un accompagnant ajouté à une invitation existante doit être nommé, hérite du côté du groupe et passe directement au placement de l’excédent.

## Invité surprise avec approbation SMS/WhatsApp à distance (v1.27.0)

- Navigation admin : Approbations est toujours dans le menu du compte. Elle apparaît aussi dans la barre du bas uniquement sur `/dashboard`, où Scan occupe le bouton central entre Recherche/Plan et Agenda/Approbations.

Depuis le 30/08/2026, un placeur, un directeur de festin ou l'admin peut gérer un invité non prévu directement depuis `/scan`, avec une approbation à distance **avant** de le laisser entrer — capacité dédiée `guestApproval` (jamais agent scan ni visibilité : « si le scanner voit des personnes en plus, il ne fait rien, il va voir le placeur directement », demande explicite de Gersom).

- **Photo** (une seule prise, appareil photo natif) → **côté** (Nelly/Gégé) → **nom + nombre d'invités** → la demande est enregistrée et un SMS **et** un message WhatsApp partent en parallèle vers l'approbateur configuré pour ce côté (`guest_approvers` : « Mon Papa » pour le côté Gégé, « Papa David » pour le côté Nelly — table de configuration, pas des numéros codés en dur, modifiable depuis Supabase sans redéploiement). Le double canal existe « au cas où [l'approbateur] n'a pas de réseau [cellulaire] et est connecté au wifi » (WhatsApp passe par data/wifi) — chacun est best-effort, l'échec de l'un (WhatsApp tant que son Content Template n'est pas encore approuvé côté Twilio/Meta) ne bloque jamais l'autre.
- Ni le SMS ni le WhatsApp ne contiennent **jamais la photo elle-même** (un numéro Twilio français ne supporte pas les MMS ; un message WhatsApp initié par l'app doit rester dans son Content Template pré-approuvé, pas de média possible) — uniquement un lien vers `/approve/[token]`, une page **publique** (sans connexion) qui l'affiche à l'ouverture.
- **Deux façons de décider**, une seule logique atomique derrière : cliquer Approuver/Refuser sur `/approve/[token]`, **ou répondre directement « Oui »/« O »/« Y » ou « Non »/« N » au message WhatsApp** (pas besoin de cliquer le lien pour décider, seulement pour voir la photo). Un seul clic/une seule réponse possible : la demande est invalidée pour tout usage futur dès la première décision (une seconde tentative affiche « déjà traité », jamais une erreur technique) — le canal utilisé est conservé (`decided_via`).
- Une fois **approuvée**, la demande apparaît dans `/approbations` (écran dédié, même capacité `guestApproval`) avec un bouton « Assigner une table » — l'ajout réel à la liste des invités et l'assignation de table restent **manuels**, jamais automatiques (demande explicite de Gersom). Cette étape crée l'invitation correspondante, mais ne la marque **pas** arrivée : le check-in se fait ensuite normalement depuis sa fiche, comme pour n'importe quel invité.
- Dans l'application, `admin`, `directeur` et `visibilite` peuvent approuver/refuser puis choisir la table ; le `placeur` conserve aussi l'assignation. Par SMS/WhatsApp ou lien public, la décision reste strictement Oui/Non : aucune table ne peut être transmise par ces canaux.
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

### Diffusion des invitations

- `/admin/diffusion` est réservé à l'admin par le middleware, comme tous les écrans `/admin`.
- Le fichier Excel/CSV est lu uniquement dans le navigateur : aucune ligne, coordonnée ou progression d'envoi n'est transmise à Supabase ou à une API de l'application.
- Le code d'invitation doit être explicite et suivre `T010`/`F004`; l'application ne déduit jamais ce code du numéro de table. Le lien produit suit `https://libalz.my.canva.site/vol-{code en minuscules}`.
- WhatsApp et email sont des raccourcis manuels avec message prérempli. Aucun envoi automatique ou en masse n'est effectué par l'application.
- Un nom ou un code Canva invalide bloque les raccourcis d'envoi afin d'éviter la transmission d'un mauvais lien. Les coordonnées invalides sont signalées avant envoi.
- Le suivi reste en mémoire jusqu'à sa réexportation Excel. Fermer ou recharger la page sans exporter perd la progression, volontairement, afin de ne pas conserver les contacts dans le navigateur.
- Aucun PIN, jeton de session ou identifiant interne ne doit apparaître dans le fichier importé ou exporté.

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

- Les listes détaillées de `/dashboard` répartissent les personnes par côté Nelly/Gégé. Le total représente les arrivés pour la liste « Arrivés », les personnes encore attendues pour « Restants », l'excédent réel pour « Supplémentaires » et le nombre prévu pour les autres listes.

- `nombre_prevu` est le nombre attendu; `nombre_arrive` est le total enregistré.
- Pour un groupe (`nombre_prevu > 1`), l'arrivée se suit PAR PERSONNE (`guests.arrival_status` : `attendu`/`arrive`/`ne_viendra_pas`), pas via un simple compteur — voir `CHANGELOG.md` v1.21.0. `nombre_arrive`/`nombre_prevu` restent les totaux dérivés, recalculés à chaque bascule d'une personne (`set_guest_arrival_status`), jamais modifiés directement. Une personne marquée `ne_viendra_pas` reste visible (grisée) et reversible, jamais supprimée. Une invitation solo (`nombre_prevu <= 1`) garde le compteur +/- classique — cas non ambigu.
- Retirer un membre diminue `nombre_prevu`; le renommer ne le modifie pas.
- Lors de la toute première création de la liste détaillée, retirer une ligne du brouillon puis enregistrer diminue également `nombre_prevu` au nombre de membres effectivement sauvegardés. Cette initialisation ne peut jamais augmenter `nombre_prevu`; un ajout passe par l'action dédiée « Ajouter une personne ».
- Déplacer une invitation conserve ses arrivées, membres et historique.
- Un débordement ne doit jamais être assigné deux fois.
- Capacité physique, places libres maintenant et occupation estimée sont des mesures différentes.
