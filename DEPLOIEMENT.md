# Guide de déploiement

L'application est un projet Next.js standard, prête à héberger sur **Vercel** (gratuit pour ce niveau d'usage). Le backend (Supabase) est déjà en place et déjà rempli avec les vraies données.

## 1. Récupérer le projet

Téléchargez/exportez le dossier du projet (`wedding-checkin/`) tel quel — tout le code est prêt.

## 2. Créer le dépôt et déployer sur Vercel

1. Créez un dépôt privé sur GitHub (ou GitLab/Bitbucket) et poussez-y le code du dossier `wedding-checkin/`.
   - Le fichier `.gitignore` exclut déjà `.env.local` et `node_modules` — ne committez jamais `.env.local`.
2. Allez sur [vercel.com](https://vercel.com), connectez votre compte GitHub.
3. "Add New… → Project", sélectionnez le dépôt.
4. Framework détecté automatiquement : Next.js. Laissez les réglages par défaut.
5. Avant de cliquer "Deploy", ouvrez la section **Environment Variables** et ajoutez les 5 variables ci-dessous (section 3).
6. Cliquez "Deploy". Au bout de 1-2 minutes, l'app est en ligne sur une URL du type `https://wedding-checkin-xxxx.vercel.app`.
7. (Optionnel) Dans Vercel → Settings → Domains, ajoutez un nom de domaine personnalisé si vous en avez un.

## 3. Variables d'environnement à renseigner sur Vercel

Ce sont exactement les mêmes que dans `.env.local` en local :

| Variable | Valeur | Où la retrouver |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://znqxmmrtvmhsfsnphjcv.supabase.co` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé "anon public" | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | clé "service_role" (⚠️ secrète, jamais dans le navigateur) | Supabase → Project Settings → API |
| `SESSION_SECRET` | chaîne aléatoire longue | Générez-en une nouvelle avec `openssl rand -hex 32`, ou réutilisez celle du `.env.local` fourni |
| `NEXT_PUBLIC_EVENT_NAME` | `Mariage Nelly & Gersom` | — |

**Pour retrouver les clés Supabase à tout moment :** connectez-vous sur [supabase.com](https://supabase.com) → ouvrez le projet → **Project Settings** (icône engrenage) → **API**. La clé `anon` est publique (déjà présente côté client), la clé `service_role` est secrète et donne un accès total à la base — ne la partagez jamais et ne la mettez jamais dans du code envoyé au navigateur.

## 4. Installer la PWA sur les téléphones le jour J

Une fois l'app en ligne (URL Vercel ou domaine personnalisé) :

- **iPhone (Safari)** : ouvrir le lien → bouton Partager → "Sur l'écran d'accueil".
- **Android (Chrome)** : ouvrir le lien → menu ⋮ → "Ajouter à l'écran d'accueil" (ou une bannière d'installation apparaît automatiquement).

L'icône apparaît alors comme une vraie app, en plein écran, sans barre d'adresse.

## 5. Comptes de connexion

Voir README.md section 2. **Recommandé avant le jour J** : dans `/admin/users`, changez le mot de passe admin et créez un compte PIN dédié pour chaque hôte/hôtesse réel(le) plutôt que de garder les comptes de test.

## 6. Support technique le jour J

- Si un téléphone perd la connexion : l'app affiche "Connexion requise pour valider cette entrée" et bloque la validation — c'est voulu, pour éviter les doublons. Attendre le retour du réseau ou basculer sur un autre téléphone/wifi.
- Le tableau de bord `/dashboard` et les exports `/admin/exports` restent la source de vérité en cas de doute.
- Base de données et code restent modifiables à tout moment via Supabase (tables, invitations) et via un nouveau déploiement Vercel (code).

## 7. Coûts

- **Vercel** : gratuit sur le plan Hobby pour ce volume de trafic.
- **Supabase** : gratuit sur le plan Free pour ce volume de données (423 personnes, quelques centaines de lignes) — largement suffisant.
