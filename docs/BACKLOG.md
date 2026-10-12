# Backlog — limites connues et actions en attente

**Version documentaire : 1.83.0**
**Dernière mise à jour : 2026-10-12**

Règle (v1.75.0, `docs/QE_QA_PROCESS.md` §6.6) : toute limite « signalée » dans une PR ou le CHANGELOG est ajoutée ici, avec un responsable, puis retirée quand elle est traitée. Le CHANGELOG raconte ce qui a été fait ; ce fichier dit ce qui reste à faire. Les éléments terminés restent listés une version puis sont retirés.

## À faire avant le 24/10/2026 (risque le jour J)

| # | Élément | Pourquoi | Responsable | Statut |
|---|---|---|---|---|
| 1 | Contrôle des 100 VIP : étiquette VIP + filtre de liste pour les scanners | L'agenda dit « vérifier la liste » à 17:10, mais aucune fonction VIP n'existe (une seule invitation contient « VIP »). | Agent, après décision de Gersom | À faire |
| 2 | Remettre les données de test à zéro (bouton rouge de `/admin`, mode test) puis passer en JOUR J | L'événement est en mode `test` avec 3 arrivées de test. | Gersom | En cours (Gersom) |
| 3 | Notifications Push : activer sur de vrais appareils après le déploiement de v1.83.0 | Les clés VAPID viennent d'être posées en production (elles manquaient) ; 0 abonnement tant qu'un placeur/directeur n'a pas activé. Le bouton est dans le menu du compte. | Gersom + placeurs/directeurs | Après déploiement |
| 4 | Test sur de vrais téléphones : scanner (lignes publiques seulement), Rémy/Tuzola (lignes en vert), bande « Prochaine activité », lecture d'un vrai QR, photo « Invité surprise », installation Android (Chrome) et iPhone | Les tests automatiques simulent la caméra et ne reçoivent pas de Push réel. | Gersom + 1 scanneur | Avant le jour J |
| 5 | PIN des scanners = 4 derniers chiffres du téléphone (décision v1.69.0) : tableau comptes/téléphones fourni le 12/10/2026 ; saisie dans « Gestion des comptes » | Aucun compte n'a de téléphone enregistré (`users.phone`) ; la correspondance se fait par le nom dans les invitations. | Gersom | À faire |
| 6 | SMS/WhatsApp (Twilio) désactivé : décider activer ou s'appuyer sur l'app et les Push | Voulu, mais à trancher. | Gersom | À décider |
| 7 | Dernier export CSV With Joy avant la soirée (la « mise à jour sûre » fonctionne le jour J) | Garder la liste à jour. | Gersom → agent | Avant le jour J |
| 8 | 10 invitations attendues sans table : 9 prestataires (photographes, DJ, traiteur) et « Nelly Dos Goncalves » (0 personne) | Table ou zone staff à décider. | Gersom | À décider |
| 9 | Relancer `scripts/sql-tests/01_first_use_flows.sql` et le contrôle de santé (`select * from app_health_report() where not ok;`) juste avant le jour J | Dernière vérification sur la vraie base. | Gersom / agent | Avant le jour J |

## Règles de qualité à activer (GitHub, propriétaire du dépôt)

| # | Élément | Statut |
|---|---|---|
| 10 | Rendre obligatoire le check « Qualité » sur `main` (Settings → Branches → Require status checks) | À faire (Gersom) |
| 11 | Comptes de test par rôle + secrets `E2E_*` (voir `e2e/README.md`, qui liste les comptes inutilisés réutilisables) | À faire (PIN + secrets : Gersom) |
| 12 | Le check `github-advanced-security` est rouge (quota Copilot épuisé) ; CodeQL reste vert | À surveiller |

## Propre mais non urgent

| # | Élément | Statut |
|---|---|---|
| 13 | Responsables en noms libres (DJ, Traiteur, Laura Humba, Amy Eliano, AngoStars, Laly Cakes, Dan Elenga, équipe média, responsable transport) | Rien à faire sans compte |
| 14 | `/checkin/[id]/merge` reste ouvrable par URL pour `agent_checkin` (l'API refuse l'écriture) | Connu, sans risque pour les données |
| 15 | Assertions « le code contient X » (~1 500) à remplacer par des tests de résultat | En cours, au fil des modifications (v1.83.0 : Push et heure de Paris) |
| 16 | Fuseau : la bande « Prochaine activité » suit l'heure de **Paris** quel que soit le réglage du téléphone (v1.83.0) | Fait |
| 17 | `.gitattributes` (LF partout) | Fait en v1.83.0 |
| 18 | Tables `canada_jets_*` supprimées, 0069/0070/0071/0072/0073 appliquées | Fait (10-11/10/2026, vérifié) |
