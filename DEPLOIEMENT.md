# Guide de déploiement

**Version documentaire : 1.14.0**
**Dernière mise à jour : 2026-08-23**

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

Vercel fournit également des identifiants de déploiement/commit. La v1.1.0 les utilise pour distinguer une session créée sur une ancienne version d'une session créée sur le déploiement courant.

## 3. Sessions et redéploiements — v1.1.0

- Durée maximale d'une session : **12 heures**.
- Une session créée sur un ancien déploiement devient invalide lorsqu'elle atteint une route protégée sur le nouveau déploiement.
- Le middleware supprime les cookies de session/rôle/nom incompatibles puis redirige vers `/login`.
- Le service worker ne doit pas mettre en cache les assets `/_next/*` afin d'éviter les anciennes versions JavaScript après un déploiement.
- `app/error.tsx` fournit une récupération supplémentaire : logout puis retour au login plutôt qu'une page blanche persistante.

Après un déploiement important, tester au moins une PWA déjà installée sur iPhone/Android avec une ancienne session.

## 4. Installation PWA

- **iPhone (Safari)** : ouvrir le lien → Partager → « Sur l'écran d'accueil ».
- **Android (Chrome)** : ouvrir le lien → menu → « Ajouter à l'écran d'accueil ».

Toute écriture de check-in nécessite une connexion réseau.

## 5. Données et capacité de référence v1.1.0

- 41 tables au total.
- Tables 1 à 40 : normales.
- Table 41 : seule réserve.
- Capacité officielle : 400 places.
- Capacité absolue avec réserve : 410 places.

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
- Si l'app revient au login après un nouveau déploiement, c'est un comportement attendu : reconnecter l'utilisateur.
- Si une ancienne PWA semble bloquée, fermer/réouvrir; le mécanisme de récupération doit ensuite charger le nouveau code ou revenir au login.
- `/dashboard` et Supabase restent les sources opérationnelles de contrôle.
