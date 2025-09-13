const CACHE_NAME = 'gemini-chatbot-v1';
const urlsToCache = [
  '/',
  'ia.html',
  'style.css',
  'script.js',
  'icon-192.png',
  'icon-512.png'
];

// Instalar el Service Worker y cachear los assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache abierto y assets cacheados');
        return cache.addAll(urlsToCache);
      })
  );
});

// Interceptar peticiones y servir desde el cache si es posible
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si encontramos una respuesta en el cache, la devolvemos. Si no, la buscamos en la red.
        return response || fetch(event.request);
      })
  );
});