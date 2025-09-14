// --- ESTRATEGIA DE CACHÉ ---
// Cambia este número de versión cada vez que despliegues cambios en tus archivos (CSS, JS, HTML).
const CACHE_VERSION = 'v3';
const CACHE_NAME = `gemini-chatbot-${CACHE_VERSION}`;

const urlsToCache = [
  '/',
  'index.html',
  'style.css',
  'script.js',
  'icon-192.png',
  'icon-512.png',
];
// 1. Evento 'install': Se dispara cuando el navegador instala el SW.
// Ideal para cachear los archivos estáticos de la aplicación (el "App Shell").
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log(`[SW] Cache ${CACHE_NAME} abierto y assets cacheados durante la instalación.`);
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        // Forza al nuevo Service Worker a activarse inmediatamente en lugar de esperar.
        return self.skipWaiting();
      })
  );
});

// 2. Evento 'activate': Se dispara después de la instalación.
// Es el momento perfecto para limpiar los cachés antiguos y obsoletos.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Si el nombre del caché no coincide con el actual, lo borramos.
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Borrando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Le dice al Service Worker que tome el control de la página inmediatamente.
      return self.clients.claim();
    })
  );
});

// 3. Evento 'fetch': Se dispara cada vez que la página realiza una petición de red.
// Aquí decidimos si servir desde el caché o desde la red.
self.addEventListener('fetch', event => {
  // Usamos una estrategia "Cache First": primero busca en el caché.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si la respuesta está en el caché, la devolvemos. Si no, la buscamos en la red.
        return response || fetch(event.request);
      })
  );
});