// LoveActs PWA Service Worker v2.2.0 - Forzar actualizaciones
const CACHE_NAME = 'loveacts-v2-2-0-cache';
const VERSION = '2.2.0';

// Archivos esenciales
const ESSENTIAL_FILES = [
  '/',
  '/manifest.json'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log(`💕 LoveActs Service Worker: Instalando v${VERSION}...`);
  
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
  console.log(`💕 Service Worker activando v${VERSION}`);
  
  event.waitUntil(
    // Limpiar TODOS los caches viejos
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
      console.log(`💕 Nueva versión v${VERSION} activada`);
      return self.clients.claim();
    }).then(() => {
      // Notificar a todos los clientes sobre la actualización
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_UPDATED',
            version: VERSION
          });
        });
      });
    })
  );
});

// Interceptar requests - SIEMPRE intentar red primero
self.addEventListener('fetch', (event) => {
  if (event.request.url.startsWith('http')) {
    event.respondWith(
      // Network First strategy para forzar actualizaciones
      fetch(event.request)
        .then(response => {
          // Si la respuesta es exitosa, clonar y cachear
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseClone);
              });
          }
          return response;
        })
        .catch(() => {
          // Solo usar cache si falla la red
          return caches.match(event.request)
            .then(response => {
              return response || new Response('Offline');
            });
        })
    );
  }
});

// Escuchar mensajes de la app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_VERSION') {
    event.ports[0].postMessage({
      type: 'VERSION_INFO',
      version: VERSION
    });
  }
});

console.log(`💕 LoveActs Service Worker v${VERSION} cargado`);