# Données, Supabase, Google Sheets et formulaires

**Version documentaire : 1.28.0**
**Dernière mise à jour : 2026-08-30**

Lire `BUSINESS_RULES.md`, `VERSIONING.md` et `DATA_CHANGE_INSTRUCTIONS.md` avant toute modification. Supabase est la source utilisée en production; Google Sheets sert à préparer et réviser le placement. Il n'existe pas de synchronisation automatique implicite.

`/admin/import-withjoy` accepte uniquement un CSV With Joy et ne transmet son contenu qu'à la route serveur admin. L'aperçu n'écrit rien. La confirmation remplace les invitations dans une transaction, après une sauvegarde JSON privée incluant invitations, membres, check-ins, débordements, exceptions et audit. Elle remet volontairement les données opérationnelles à zéro et reste donc interdite en mode live/closed.

## État de référence v1.15.3

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
| Transférer/échanger en lot | invitations, audit | Admin, directeur, placeur |
| Ajouter invitation | invitations | Admin uniquement |
| Renommer invitation | invitations, audit | Admin, directeur, placeur, agent scan |
| Fusionner deux invitations | invitations, checkins, overflow_assignments, invitation_guests, exceptions, audit | Admin uniquement |
| Ajouter/retirer une étiquette | invitations, audit | Admin uniquement |
| Import/administration | tables, invitations, users, événement | Admin uniquement |
| Diffusion des invitations | Excel/CSV local en mémoire, aucune écriture serveur | Admin uniquement |
| Invité surprise (capture live + demande d'approbation) | guest_approval_requests, Storage (bucket privé), audit | Admin, placeur |
| Voir les demandes d'approbation | guest_approval_requests | Admin, directeur, placeur, visibilité |
| Décider dans l'application | guest_approval_requests, audit | Admin, directeur, visibilité |
| Décider (approuver/refuser) un invité surprise — lien web | guest_approval_requests, audit | Public (token secret, sans connexion) |
| Décider (approuver/refuser) un invité surprise — réponse WhatsApp | guest_approval_requests, audit | Public (signature Twilio, sans connexion) |
| Assigner une table à un invité surprise approuvé | guest_approval_requests, invitations, audit | Admin, placeur |

La page `/staff` est une lecture filtrée de `invitations.category = 'Staff'`. Elle ne crée aucun nouveau type d'écriture : toucher une ligne réutilise le check-in existant. Pour les futurs imports With Joy, `notable` conserve `table_id = NULL` sauf si un tag `Txxx`/`Fxxx` explicite est présent.

`scripts/build_plan_from_csv.py` extrait `phone number` par personne (colonne With Joy) vers `telephone` : pour une invitation groupée, c'est le premier téléphone non vide du foyer. Conformément à la règle d'individuation du staff (`docs/BUSINESS_RULES.md`), le script isole chaque personne portant un tag de rôle staff dans sa propre invitation — y compris quand plusieurs membres d'un même foyer sont staff — pour permettre de cocher l'arrivée de chacun séparément ; les membres non-staff du même foyer restent groupés.

`Needs_Table_Gege`/`Needs_Table_Nelly` (nouveau tag With Joy découvert le 22/08/2026) : traité comme `notable` (jamais d'auto-assignation via le pool aléatoire), et explicitement exclu des tags de rôle staff — voir `docs/QE_QA_PROCESS.md` §4 cas 14.

Transfert/échange en lot (`/tables/[tableId]`, `/table/[tableId]`, `/tables/move-multiple`) : champs `invitation_ids`/`new_table_id` (transfert) ou `ids_out_of_a`/`table_a`/`ids_out_of_b`/`table_b` (échange) ; validation serveur dans `/api/move-invitations` et `/api/swap-invitations` (rôle admin/directeur/placeur, tableau non vide, tables distinctes pour un échange) ; fonctions SQL `move_invitations_table`/`swap_invitations_between_tables` (`0020_bulk_move_and_swap_invitations.sql`) ; effet secondaire : une ligne `audit_logs` (`action = 'invitation_move'`) par invitation déplacée, temps réel via les abonnements déjà en place sur `invitations` ; hors ligne : bouton désactivé comme le déplacement individuel ; la sélection en cours (IDs + table de départ) transite par `sessionStorage` (`lib/bulkMoveSession.ts`), jamais par Supabase ni par l'URL.

Renommer une invitation (`/checkin/[invitationId]`) : champ `nouveau_nom` ; validation serveur dans `/api/invitations/rename` (rôle admin/directeur/placeur/agent scan, comme la gestion des membres) ; fonction SQL `rename_invitation` (`0021_rename_and_merge_invitations.sql`) ; ne modifie que `nom_affichage`, effet secondaire : une ligne `audit_logs` (`action = 'invitation_rename'`, ancien/nouveau nom).

Fusionner deux invitations (`/checkin/[invitationId]/merge`) : champs `source_invitation_id`/`target_invitation_id` ; validation serveur dans `/api/invitations/merge` (rôle admin/directeur/placeur) ; fonction SQL `merge_invitations` (`0021_rename_and_merge_invitations.sql`) : additionne `nombre_prevu`/`nombre_arrive`/`nombre_supplementaire`, réattache `checkins`/`overflow_assignments`/`invitation_guests`/`exceptions`/`audit_logs` de la source vers la cible avant de supprimer la source (rien n'est perdu, contrairement à une suppression directe qui ferait disparaître les checkins/débordements en cascade) ; effet secondaire : une ligne `audit_logs` (`action = 'invitation_merge'`) ; avertissement (non bloquant) si les deux invitations sont `category = 'Staff'`.

Ajouter/retirer une étiquette (`/checkin/[invitationId]`, section « 🏷️ Étiquettes ») : champ `tag` (raccourcis proposés : `Côté_Gege`, `Côté_Nelly`, `SERVICES`, `Photographe`, `Prestataire`, `DJ_Animation`, `notable`, ou saisie libre) ; validation serveur dans `/api/invitations/tags/add` et `/api/invitations/tags/remove` (capacité dédiée `manageTags` — rôle admin/directeur/placeur ; agent scan ne l'a plus depuis le 23/08/2026, à la différence du renommage qui reste sur `manageMembers`) ; fonctions SQL `add_invitation_tag`/`remove_invitation_tag` (`0022_manage_invitation_tags.sql`, synchronisées pour `Needs_Table_*` par `0023_sync_needs_table_tag_rules.sql`), idempotentes (ajouter un tag déjà présent ou retirer un tag absent ne fait rien et ne journalise pas) ; effets secondaires : `tags` (ajout/retrait), synchronisation de `cote` pour `Côté_Gege`/`Côté_Nelly` (mutuellement exclusifs), passage automatique de `category` à `'Staff'` à l'ajout d'un tag de rôle et retour à `null` au retrait du dernier tag de rôle restant (même heuristique que `scripts/build_plan_from_csv.py`, à garder synchronisée) ; une ligne `audit_logs` (`action = 'invitation_tag_add'`/`'invitation_tag_remove'`) par changement.

Invité surprise avec approbation (`/scan`, v1.28.0) : `admin`/`placeur` appuient sur le bouton photo central ; `QrScanner.captureFrame()` copie une frame du `<video>` déjà ouvert vers un canvas puis produit un JPEG — aucun sélecteur de fichier et aucune ouverture de l'app Caméra. Après choix du côté Nelly/Gégé, nom et nombre, `POST /api/guest-approvals` (capacité `submitGuestApproval`) dépose l'image dans le bucket **privé** `guest-approval-photos`. La demande est visible dans `/approbations` (`viewGuestApprovals`) ; `admin`/`directeur`/`visibilite` décident directement (`reviewGuestApproval`) et `admin`/`placeur` assignent la table (`assignGuestApproval`). Twilio SMS/WhatsApp reste envoyé en parallèle, best-effort, avec lien public secret `/approve/[token]` ; une panne Twilio n'annule jamais la demande enregistrée.

Push PWA (`0037_guest_approval_app_push.sql`) : l'approbateur active volontairement les notifications depuis `/approbations`. L'abonnement est écrit par `POST /api/push/subscribe` dans `push_subscriptions`, table RLS sans policy et sans grant anon/authenticated. Variables Vercel requises : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Sans elles, l'interface l'indique et continue avec le badge dans l'app et Twilio.

Décision — deux canaux, une seule logique atomique partagée (`lib/guestApprovalDecide.ts`) :
- **Lien web** (`/approve/[token]`, page **publique**, sans connexion) : `POST /api/public/guest-approvals/[token]/decide`, champ `decision` (`approuve`/`refuse`) ; la connaissance du token EST l'autorisation.
- **Réponse WhatsApp** (« Oui »/« O »/« Y » ou « Non »/« N », insensible à la casse/aux accents) : webhook `POST /api/public/twilio/whatsapp-inbound`, authentifié par la signature Twilio (`X-Twilio-Signature`, HMAC-SHA1, *fail closed* sans `TWILIO_AUTH_TOKEN`) plutôt que par un token dans l'URL — une réponse texte libre n'en porte pas ; la demande concernée est retrouvée par numéro de téléphone (la plus récente encore `en_attente` pour ce numéro) ; répond en TwiML pour confirmer directement dans la conversation.

Dans tous les cas : l'update est gardé par `statut = 'en_attente'` dans la clause `WHERE` (atomique, une deuxième décision est refusée) ; effet secondaire : `audit_logs` avec le canal dans `details.via`, colonne `decided_via` (`'web'`/`'whatsapp'`/`'app'`) et confirmation best-effort. `guest_approval_requests` n'a aucune policy RLS anon : tous les accès passent par des routes API serveur.

Assigner une table (`/approbations/[id]/assign`) : champ `table_id`, sélecteur `TablePicker` ; validation serveur dans `POST /api/guest-approvals/[id]/assign-table` (capacité `assignGuestApproval`, admin/placeur) ; fonction SQL `assign_table_to_guest_approval` (`0032_guest_approvals.sql`) : refuse une demande pas encore `approuve` (409) ou déjà assignée (409), crée l'invitation, marque la demande assignée et journalise.

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
