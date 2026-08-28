# Prompt Claude — navigation et résilience v1.17.0

Applique et préserve les règles suivantes dans `Gegeboss-Ditagil/mariage-checkin`.

## Objectif

- Le bouton de compte en haut affiche le nom, le rôle, les liens autorisés et la déconnexion.
- `Historique` apparaît si `viewHistory`; `Administration` uniquement si `adminPanel`.
- Ces deux liens ne figurent plus dans la barre inférieure.
- Tout raccourci général `Tables` ouvre `/plan-table`; `/tables` redirige côté serveur vers `/plan-table`. Les routes détaillées `/tables/[tableId]`, déplacement et ajout restent disponibles selon les capacités existantes.
- `/plan-table` regroupe le plan, la recherche table/ville/vol/invité, le tri numéro/places libres, le code `Vol-Fxxx` ou `Vol-Txxx`, les places prévues et les arrivées.
- Ne jamais fusionner les dimensions : placement = provisoire/confirmé; présence = non arrivé/partiel/arrivé/excédent.

## Rôles à préserver

- `admin`: historique, administration et toutes les actions sensibles.
- `directeur`: historique, déplacements opérationnels et appels; aucun panneau admin.
- `placeur`: déplacements opérationnels; aucune fusion, ajout, gestion d'étiquettes ou administration.
- `agent_checkin`: scan/check-in, recherche et consultation du plan; aucun déplacement structurel.
- `visibilite`: lecture seule, sans caméra ni écriture.
- Toute barrière visuelle doit avoir son équivalent serveur via `hasCapability`; ne pas recréer de liste locale de rôles.

## Résilience obligatoire

- Le démontage de la caméra pendant une navigation rapide ne doit jamais appeler `stop()` si le scanner n'est pas actif et ne doit produire aucune promesse rejetée.
- Le service worker ignore les protocoles non HTTP(S), les extensions et les origines externes; il ne met jamais en cache API, Supabase ou chunks Next.js.
- Une réponse réseau absente ne doit jamais produire une valeur `undefined` dans `respondWith`.
- Les anciens favoris `/tables` doivent continuer à fonctionner grâce à la redirection.
- Aucun changement Supabase ou migration n'est nécessaire pour ce lot.

## Vérifications exigées

Exécuter :

```text
npx tsc --noEmit
npm run test:roles
npm run test:floorplan
npm run test:members
npm run test:diffusion
npm run test:withjoy
npm run test:navigation
npm run build
```

Tester aussi les parcours rapides Scan → Plan → détail table → retour → Plan → Scan, menu compte ouvert/fermé au clavier et au toucher, recherche/tri, redirection `/tables`, hors ligne, caméra refusée et caméra absente. Vérifier au minimum les dimensions 390×844 (iPhone), 768×1024 (iPad/tablette) et 1440×900 (ordinateur), sans débordement horizontal ni erreur console.

## Complément v1.18.0 — charge à ~20 personnes et import CSV depuis iPhone

Ajouté après une première implémentation de ce prompt, sur demande explicite de Gersom (« assurer qu'on n'a pas d'erreurs quand 20 personnes utiliseront l'app en même temps en faisant des changements et en changeant de page rapidement » ; « le prochain import sera directement depuis le CSV With Joy, téléchargé sur iPhone et ajouté directement dans l'app, la mise à jour doit être rapide et instantanée pour tout le monde »). Complète l'implémentation existante sans la remplacer.

- `lib/debounce.ts` : regroupe une rafale d'événements Realtime (`postgres_changes`) en un seul rechargement, sur les 7 écrans qui rechargent tout leur état (`/dashboard`, `/plan-table`, `/table/[tableId]`, `/tables/[tableId]`, `/tables/move/[invitationId]`, `/checkin/[invitationId]/members`, `/exceptions`) — un réimport CSV ou une correction en lot modifie des dizaines/centaines de lignes en quelques centaines de millisecondes ; sans regroupement, chaque écran ouvert relançait un rechargement complet par ligne modifiée, ce qui multipliait les requêtes Supabase en parallèle avec ~20 personnes connectées.
- `app/global-error.tsx` : filet de secours si le layout racine (`app/layout.tsx`) plante lui-même — `app/error.tsx` ne couvre que ce qui est sous ce layout.
- `public/sw.js` : le repli hors ligne sur une navigation pouvait encore résoudre en `undefined` si ni `/offline` ni `/` n'étaient en cache — corrigé avec le même filet `Response.error()` déjà utilisé pour les autres assets.
- `/admin/import-withjoy` : le sélecteur de fichier accepte plusieurs alias MIME (au-delà de `.csv`/`text/csv`) pour rester utilisable depuis le sélecteur « Parcourir » de Safari iOS après un téléchargement iPhone.
- Tests : `tests/realtime-debounce.test.ts` (`npm run test:realtime`).
