// LoveActs PWA Service Worker v2.1.0 - Modificaciones implementadas
const CACHE_NAME = 'loveacts-v2-1-0-cache';

// Archivos esenciales
const ESSENTIAL_FILES = [
  '/',
  '/manifest.json'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('💕 LoveActs Service Worker: Instalando v2.1...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('💕 Cache abierto');
        return cache.addAll(ESSENTIAL_FILES);
      })
      .then(() => {
        console.log('💕 Archivos cacheados');
        // Activar inmediatamente nueva versión
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('💔 Error en instalación:', error);
      })
  );
});

// Activar Service Worker
self.addEventListener('activate', (event) => {
  console.log('💕 Service Worker activando v2.1');
  
  event.waitUntil(
    // Limpiar caches viejos
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Tomar control inmediatamente
      console.log('💕 Nueva versión activada');
      return self.clients.claim();
    })
  );
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

// Notificar a la app sobre actualizaciones
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('💕 LoveActs Service Worker v2.1 cargado');