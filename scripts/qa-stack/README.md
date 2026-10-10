# Pile de test fonctionnel (v1.76.0)

Fait tourner **toute l'application** (Next.js, API, base PostgreSQL avec
toutes les migrations du dépôt) en local ou sur GitHub, avec des données
synthétiques, puis la fait utiliser par un vrai navigateur. Jamais la
production.

| Élément | Rôle |
|---|---|
| `00_supabase_shim.sql` | rôles, schémas et extensions d'un projet Supabase |
| `build-db.sh` | reconstruit la base : socle + **toutes** les migrations dans l'ordre + `seed.ts` |
| `seed.ts` | données synthétiques : 42 tables, 121 invitations jamais ouvertes, 1 compte par rôle |
| `gateway.mjs` | imite l'URL Supabase : `/rest/v1` → PostgREST, stockage photo en mémoire |
| `start.sh` | PostgREST + passerelle + build et démarrage de l'application (port 3100) |

Comptes de test (pile locale uniquement) : `QA Admin` 1111, `QA Directeur`
2222, `QA Placeur` 3333, `QA Scanneur` 4444, `QA Approbateur` 5555.

## Lancer
```
PGHOST=/tmp PGPORT=54329 npm run qa:db          # PostgreSQL 16 local requis
QA_POSTGREST_BIN=/chemin/postgrest npm run qa:stack
set -a; . scripts/qa-stack/.env.qa; set +a
npm run qa:functional
```
Sur GitHub, tout cela tourne automatiquement sur chaque PR
(`.github/workflows/quality.yml`).

## Ce que vérifient les tests (`qa/functional/`)
- `crawl-every-click.spec.ts` : chaque rôle, chaque page, chaque bouton —
  erreurs JS, erreurs serveur, appels refusés, déconnexions, « Accès réservé »
  atteint par un clic, lenteur (> 3 s), sauts de mise en page (CLS > 0,25).
- `business-flows.spec.ts` : check-in, invité surprise approuvé puis visible
  sur le dessin de sa table, « Reconsidérer » → placé, Approbateur, santé de
  la base, plan, déconnexion.
- `network-and-concurrency.spec.ts` : 3G lente, coupure réseau, deux agents
  sur la même famille en même temps.
