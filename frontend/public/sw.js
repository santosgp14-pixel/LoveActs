// LoveActs PWA Service Worker v2.0 - Simplified
const CACHE_NAME = 'loveacts-v2-cache';

// Archivos esenciales
const ESSENTIAL_FILES = [
  '/',
  '/manifest.json'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('💕 LoveActs Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('💕 Cache abierto');
        return cache.addAll(ESSENTIAL_FILES);
      })
      .then(() => {
        console.log('💕 Archivos cacheados');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('💔 Error en instalación:', error);
      })
  );
});

// Activar Service Worker
self.addEventListener('activate', (event) => {
  console.log('💕 Service Worker activado');
  event.waitUntil(self.clients.claim());
});

// Interceptar requests básico
self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith('http')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match(event.request)
            .then(response => {
              return response || new Response('Offline');
            });
        })
    );
  }
});

console.log('💕 LoveActs Service Worker cargado');