// Service worker de l'app check-in mariage.
//
// Strategie volontairement conservatrice pour respecter le principe
// "connexion requise pour valider une entree" :
// - Les requetes API (/api/*) et vers Supabase ne sont JAMAIS interceptees
//   ni servies depuis le cache : elles doivent toujours passer par le reseau,
//   pour ne jamais laisser un agent croire qu'une ecriture a reussi hors ligne.
// - Seule la coquille de l'app (pages statiques, JS/CSS, icones, manifest)
//   est mise en cache pour permettre l'affichage d'un ecran "hors ligne"
//   propre plutot qu'une erreur de navigateur.

const CACHE_NAME = 'checkin-shell-v1';
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

  // Jamais de cache pour les ecritures/lectures API ou Supabase : toujours reseau.
  if (request.method !== 'GET' || url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    return;
  }

  // Navigation (changement de page) : reseau d'abord, fallback offline si echec.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline').then((res) => res || caches.match('/')))
    );
    return;
  }

  // Assets statiques (JS/CSS/icones) : cache d'abord, reseau en secours + mise a jour du cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
