/**
 * service-worker.js — Délais procéduraux
 * Cache statique + mise à jour automatique (stale-while-revalidate)
 */

'use strict';

const CACHE_NAME = 'delais-proceduraux-v1.1';

const STATIC_ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './webmanifest.json',
  './icons/icon_192px.png',
  './icons/icon_512px.png',
  './icons/balance_50px.png',
];

/* --- Installation : mise en cache des ressources statiques --- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  // Prise de contrôle immédiate sans attendre la fermeture des onglets existants
  self.skipWaiting();
});

/* --- Activation : suppression des anciens caches --- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  // Prendre le contrôle de tous les clients dès l'activation
  self.clients.claim();
});

/* --- Interception des requêtes : Cache First avec revalidation --- */
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET et les requêtes cross-origin (ex. jsPDF CDN)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isLocal = url.origin === self.location.origin;

  if (isLocal) {
    // Stratégie stale-while-revalidate pour les ressources locales
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (response && response.status === 200) {
                cache.put(event.request, response.clone());
              }
              return response;
            })
            .catch(() => null);

          return cached || fetchPromise;
        })
      )
    );
  }
  // Pour les ressources externes (jsPDF CDN), laisser passer sans interception
});
