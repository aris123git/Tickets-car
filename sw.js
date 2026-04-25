// Changer la version ici pour forcer une mise à jour
const CACHE_VERSION = 'carexpress-v2';
const ASSETS = [
  '/index.html',
  '/manifest.json'
];

// ============================================================
// INSTALL — mise en cache des assets
// ============================================================
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(ASSETS))
  );
  // Force la mise à jour immédiate sans attendre la fermeture des onglets
  self.skipWaiting();
});

// ============================================================
// ACTIVATE — supprime les anciens caches automatiquement
// ============================================================
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION)
          .map(k => {
            console.log('[SW] Suppression ancien cache:', k);
            return caches.delete(k);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — Network first pour les APIs, Cache first pour assets
// ============================================================
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Toujours utiliser le réseau pour Supabase (données en temps réel)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('jsdelivr')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache first pour les assets statiques
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(response => {
          // Mettre en cache les nouvelles ressources
          if (response.ok && e.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});

// ============================================================
// PUSH NOTIFICATIONS (point 27)
// ============================================================
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'CarExpress BF';
  const options = {
    body: data.body || 'Vous avez une notification',
    icon: data.icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: data.url ? { url: data.url } : {},
    actions: data.actions || []
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Ouvrir l'app quand on clique sur une notification
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ============================================================
// MESSAGE — permet de forcer une mise à jour depuis l'app
// ============================================================
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
