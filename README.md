# Check-in Mariage Nelly & Gersom

Application de check-in pour le mariage — 8 octobre 2026 (à ajuster dans Supabase si besoin).
PWA (installable sur téléphone), fonctionne avec connexion requise pour valider une entrée.

423 invités / 200 invitations (foyers, familles, groupes) répartis sur 44 tables, déjà importés et placés dans la base réelle.

## 1. C'est quoi, concrètement

- Les hôtes/hôtesses scannent le QR code sur la table de l'invité (ou cherchent son nom), voient qui est attendu, et cochent les personnes présentes au fur et à mesure.
- Un tableau de bord admin suit en direct : arrivés / attendus / tables pleines / débordements.
- Les débordements (plus de monde que prévu à une table) sont assignés à des tables de réserve.
- Tout est granulaire par invitation (foyer), pas par invité individuel — c'est le modèle retenu pour rester simple et rapide le jour J.

## 2. Rôles

| Rôle | Connexion | Peut faire |
|---|---|---|
| Admin | email + mot de passe | Tout : configuration, tables, invitations, exports, comptes équipe |
| Placeur | nom + code PIN | Voir le plan de placement, gérer les débordements |
| Agent d'accueil | nom + code PIN | Scanner / rechercher, cocher les arrivées |

Comptes déjà créés dans la base réelle (à changer avant le jour J, voir section Sécurité) :

- **Admin** — `gersomdos@gmail.com` / `Mariage2026!`
- **Agent Test 1** — nom `Agent Test 1`, PIN `1234`
- **Placeur Test** — nom `Placeur Test`, PIN `5678`

## 3. Stack technique

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase (Postgres + API) comme backend
- PWA : manifest + service worker (installable, écran d'accueil, mode hors-ligne pour la consultation ; **toute validation d'arrivée nécessite une connexion internet**, par choix — pour éviter les doublons/désynchronisations entre plusieurs téléphones)

## 4. Structure du projet

```
src/app/            pages (App Router) : login, scan, search, tables, table/[id],
                     checkin/[invitationId], dashboard, placement, exceptions, history,
                     admin/* (wizard, tables, import, qr, users, exports)
src/app/api/         routes API (auth, checkin, export, admin/*, overflow, exceptions, history)
src/lib/             clients Supabase, session, exports, types
src/components/      composants partagés (TopBar, QrScanner, etc.)
src/hooks/           hooks (ex: useOnline)
supabase/migrations/ schéma SQL de la base
public/               manifest PWA, service worker, icônes
scripts/              scripts ponctuels utilisés pour importer les vraies données
                       et générer l'assignation des tables (voir section 6)
```

## 5. Configuration (`.env.local`)

Copier `.env.example` en `.env.local` et remplir :

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
SESSION_SECRET=...
NEXT_PUBLIC_EVENT_NAME="Mariage Nelly & Gersom"
```

Ce projet est déjà connecté au projet Supabase réel (`znqxmmrtvmhsfsnphjcv`) avec les vraies données importées. Le fichier `.env.local` de ce workspace contient déjà les bonnes valeurs — voir `DEPLOIEMENT.md` pour les récupérer à nouveau si besoin.

## 6. Données réelles déjà en base

- **200 invitations / 423 personnes** importées depuis l'export "With Joy" fourni, en gardant tout le monde (invités, familles, DJ, MC, photographe, etc. — personne n'est exclu).
- **44 tables** réelles : 7 tables "F" (familles proches) + 33 tables "T" + 4 tables de réserve, avec les vrais noms de villes du modèle Google Sheet.
- **Assignation des tables** déjà effectuée pour les 200 invitations (voir `ASSIGNATION_TABLES.md`).

Les scripts dans `scripts/` (`gen_real_seed.py`, `assign_tables.py`, `pack_tables.py`, etc.) documentent comment ces données ont été générées à partir du CSV — ils ne sont pas nécessaires pour faire tourner l'application, gardez-les pour référence ou pour un futur ré-import via `/admin/import`.

## 7. Utilisation le jour J

1. Chaque hôte/hôtesse se connecte sur son téléphone (PIN).
2. Scan du QR sur la table, ou recherche par nom.
3. Coche les personnes présentes → décompte mis à jour en direct partout.
4. En cas de surplus à une table, le placeur assigne la personne à une table de réserve depuis `/placement`.
5. L'admin suit tout depuis `/dashboard` et peut exporter les listes (arrivés, absents, partiels, supplémentaires, répartition, réserve) en CSV/XLSX depuis `/admin/exports`.

## 8. Documents liés

- `DEPLOIEMENT.md` — comment mettre l'application en ligne (Vercel) et la connecter à Supabase.
- `ASSIGNATION_TABLES.md` — détail de la méthode utilisée pour placer les 200 invitations sur les 44 tables, et l'état actuel des réserves.
