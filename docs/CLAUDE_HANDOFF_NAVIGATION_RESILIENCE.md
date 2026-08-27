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
