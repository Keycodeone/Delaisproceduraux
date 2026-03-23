/* ─── service-worker.js — Délais procéduraux ─────────────────────────────── */
'use strict';

const CACHE_NAME = 'delais-v1.2';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './webmanifest.json',
  './icons/icon_192px.png',
  './icons/icon_512px.png',
  './icons/balance_50px.png',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

// ── Installation ─────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      // On essaie chaque ressource individuellement pour ne pas bloquer sur les fonts
      Promise.allSettled(
        STATIC_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn('[SW] Cache miss :', url, err))
        )
      )
    )
  );
  // Ne pas attendre l'expiration de l'ancien SW pour activer
  self.skipWaiting();
});

// ── Activation ───────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    // Suppression des anciens caches
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Message (skip waiting depuis app.js) ─────────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Fetch — Stratégie Cache First avec fallback réseau ───────────────────────
self.addEventListener('fetch', event => {
  // Ne traiter que les requêtes GET
  if (event.request.method !== 'GET') return;

  // Ignorer les requêtes d'extension navigateur
  const url = new URL(event.request.url);
  if (!['http:', 'https:'].includes(url.protocol)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Revalider en arrière-plan (stale-while-revalidate)
        const fetchPromise = fetch(event.request)
          .then(response => {
            if (response && response.status === 200 && response.type !== 'opaque') {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {/* réseau indisponible, pas grave */});

        event.waitUntil(fetchPromise);
        return cached;
      }

      // Pas en cache : récupération réseau + mise en cache
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;

        // Ne pas mettre en cache les réponses opaques (cross-origin sans CORS)
        if (response.type === 'opaque') return response;

        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return response;
      }).catch(() =>
        // Offline et pas en cache : retourner la page principale
        caches.match('./index.html')
      );
    })
  );
});
