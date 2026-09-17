# Guide de déploiement

**Version documentaire : 1.53.19**
**Dernière mise à jour : 2026-09-17**

L'application est un projet Next.js déployé sur Vercel avec Supabase en backend.

## 1. Version déployée

La version applicative est définie dans `package.json`. Avant tout déploiement de production :

1. vérifier la version cible ;
2. vérifier l'entrée correspondante dans `CHANGELOG.md` ;
3. vérifier `docs/VERSIONING.md` ;
4. confirmer que les documents fonctionnels portent la même version ;
5. déployer uniquement après validation du build et des scénarios QA pertinents.

## 2. Variables d'environnement

Variables nécessaires :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé publique Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | clé serveur secrète, jamais exposée au navigateur |
| `SESSION_SECRET` | secret de signature des sessions |
| `NEXT_PUBLIC_EVENT_NAME` | nom de l'événement |
| `VAPID_PUBLIC_KEY` | clé publique Web Push, renvoyée aux appareils autorisés |
| `VAPID_PRIVATE_KEY` | clé privée Web Push, serveur uniquement |
| `VAPID_SUBJECT` | contact du propriétaire Push, ex. `mailto:adresse@example.com` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | identifiants Twilio pour le SMS -- ignorés tant que le SMS/WhatsApp est désactivé (voir ci-dessous) |
| `TWILIO_WHATSAPP_NUMBER` / `TWILIO_WHATSAPP_CONTENT_SID_REQUEST` | canal WhatsApp optionnel, complément au SMS -- ignoré tant que désactivé (et silencieusement no-op même une fois activé si ces deux variables manquent, canal optionnel) |

Pour générer une paire VAPID une seule fois : `npx web-push generate-vapid-keys`. Copier les deux valeurs dans Vercel (Production), ajouter `VAPID_SUBJECT`, puis redéployer. Ne jamais committer la clé privée. Sans ces variables, les badges et alertes à l'intérieur de l'application continuent de fonctionner, mais iOS ne peut pas réveiller une PWA fermée. Cette configuration Vercel ne nécessite aucun SQL supplémentaire si la migration `0037_guest_approval_app_push.sql` est déjà appliquée.

**Activer/désactiver le SMS/WhatsApp d'approbation d'invité surprise** : depuis `/admin` (bouton bascule « SMS/WhatsApp (Twilio) »), sans redéploiement ni accès Vercel. v1.48.3 introduisait un interrupteur par variable d'environnement (`TWILIO_ENABLED`) ; v1.53.2 (16/09/2026) le remplace par la colonne `events.twilio_enabled` (migration `0055_events_twilio_enabled.sql`), modifiable en un clic depuis l'application. Les identifiants `TWILIO_*` ci-dessus restent nécessaires sur Vercel (ce toggle ne les remplace pas) — sans eux, activer le bouton produit une erreur de configuration explicite plutôt qu'un envoi silencieux.

## 3. Sessions et redéploiements — v1.1.0, révisé v1.53.19

- Durée maximale d'une session : **12 heures**.
- **(v1.53.19, corrigé)** Un déploiement n'invalide plus une session active. Avant cette version, le jeton portait `ver = VERCEL_DEPLOYMENT_ID` (identifiant fourni par Vercel) : CHAQUE déploiement, même un correctif sans aucun rapport avec les sessions, invalidait instantanément toutes les sessions actives à la prochaine requête protégée — sur un projet qui déploie très fréquemment, c'était la cause principale d'un signalement de déconnexions fréquentes en navigation (17/09/2026, retour de Gersom : "après 5-6 pages, ça se déconnecte souvent"). `lib/sessionVersion.ts` porte désormais `SESSION_SCHEMA_VERSION`, une constante incrémentée À LA MAIN uniquement quand le FORMAT du payload change réellement (champ ajouté/retiré/renommé dans `SessionUser`) — jamais à chaque déploiement de code.
- Le middleware ne nettoie plus les cookies sur une simple requête de préchargement (`next-router-prefetch`, déclenchée automatiquement par chaque `<Link>` visible à l'écran) — seule une vraie navigation protégée sans session valide efface les cookies puis redirige vers `/login`.
- Le service worker ne doit pas mettre en cache les assets `/_next/*` afin d'éviter les anciennes versions JavaScript après un déploiement.
- `app/error.tsx` fournit une récupération supplémentaire : logout puis retour au login plutôt qu'une page blanche persistante.

Après un déploiement important, tester au moins une PWA déjà installée sur iPhone/Android avec une session déjà ouverte : elle doit rester connectée (voir `docs/QA_SCENARIOS.md`).

## 4. Installation PWA

- **iPhone (Safari)** : ouvrir le lien → Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : ouvrir le lien → menu → « Ajouter à l'écran d'accueil ».

Toute écriture de check-in nécessite une connexion réseau.

## 5. Données et capacité de référence (v1.1.0, mis à jour v1.47.0)

- 42 tables au total.
- Tables 1 à 41 : normales (la 41, ex-réserve, renommée « Houston » le 14/09/2026).
- Table 42 (« Johannesburg ») : seule réserve.
- Capacité officielle : 410 places.
- Capacité absolue avec réserve : 420 places.

Toute modification structurelle des tables doit être faite via une nouvelle migration et documentée dans `CHANGELOG.md`.

## 6. Procédure de release

1. Créer une branche dédiée.
2. Modifier le code et les tests.
3. Déterminer le bump de version selon `docs/VERSIONING.md`.
4. Mettre à jour `package.json`, `CHANGELOG.md` et les documents concernés.
5. Exécuter les tests/TypeScript/build disponibles.
6. Ouvrir une PR mentionnant explicitement la version avant/après.
7. Merger après validation.
8. Vérifier le déploiement Vercel et tester une ancienne session/PWA si la release touche auth, navigation ou cache.

## 7. Support le jour J

- Si un téléphone perd internet, ne pas valider d'arrivée hors ligne.
- **(v1.53.19)** Un déploiement n'est plus censé déconnecter qui que ce soit — si l'app revient au login pendant l'événement sans qu'aucune action de l'utilisateur ne l'explique, c'est désormais une anomalie à signaler, pas un comportement attendu (avant cette version, c'était le cas après chaque déploiement).
- Si une ancienne PWA semble bloquée, fermer/réouvrir; le mécanisme de récupération doit ensuite charger le nouveau code sans déconnecter une session par ailleurs valide.
- `/dashboard` et Supabase restent les sources opérationnelles de contrôle.
