// Service worker de l'app check-in mariage.
//
// Strategie volontairement conservatrice pour respecter le principe
// "connexion requise pour valider une entree" :
// - Les requetes API (/api/*) et vers Supabase ne sont JAMAIS interceptees
//   ni servies depuis le cache : elles doivent toujours passer par le reseau,
//   pour ne jamais laisser un agent croire qu'une ecriture a reussi hors ligne.
// - Les fichiers Next.js versionnes (/_next/*) ne sont pas non plus interceptes
//   par le service worker. Cela evite qu'une PWA ouverte avant un deploiement
//   conserve d'anciens chunks JS et affiche une page blanche au retour.
// - Seule la coquille minimale de l'app (offline, manifest, icones) est mise en
//   cache pour fournir un ecran hors ligne propre.

const CACHE_NAME = 'checkin-shell-v3';
const APP_SHELL = ['/', '/offline', '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Les extensions de navigateur et ressources d'une autre origine ne font
  // pas partie de la PWA. CacheStorage refuse notamment chrome-extension://.
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== self.location.origin) return;

  // Jamais de cache pour les ecritures/lectures API, Supabase ou les assets
  // Next.js. Le navigateur gere son propre cache HTTP pour /_next/* et les noms
  // de fichiers hashes garantissent la bonne version apres deploiement.
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.hostname.includes('supabase.co')
  ) {
    return;
  }

  // Navigation : reseau d'abord, fallback offline si echec -- et un dernier
  // filet non vide si meme '/offline' et '/' sont absents du cache (ex:
  // premiere installation interrompue avant la fin de cache.addAll) : un
  // respondWith() resolu en undefined fait planter la requete cote
  // navigateur (souvent une page blanche), jamais acceptable ici.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match('/offline')
          .then((res) => res || caches.match('/'))
          .then((res) => res || Response.error())
      )
    );
    return;
  }

  // Autres assets statiques (icones/manifest) : cache d'abord, reseau en
  // secours + mise a jour du cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => cached || Response.error());
      return cached || network;
    })
  );
});
