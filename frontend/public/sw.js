// LoveActs PWA Service Worker v2.0
// Proporciona funcionalidad offline y cache inteligente

const CACHE_NAME = 'loveacts-v2-cache';
const OFFLINE_CACHE = 'loveacts-offline-v2';
const API_CACHE = 'loveacts-api-v2';

// Archivos esenciales para funcionar offline
const ESSENTIAL_FILES = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png'
];

// URLs de API que se pueden cachear
const CACHEABLE_API_PATTERNS = [
  /\/api\/me$/,
  /\/api\/health$/,
  /\/api\/activities\/daily\//,
  /\/api\/memories\/special$/,
  /\/api\/achievements$/
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('💕 LoveActs Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('💕 Cache abierto:', CACHE_NAME);
        return cache.addAll(ESSENTIAL_FILES);
      })
      .then(() => {
        console.log('💕 Archivos esenciales cacheados');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('💔 Error en instalación:', error);
      })
  );
});

// Activar Service Worker
self.addEventListener('activate', (event) => {
  console.log('💕 LoveActs Service Worker: Activando...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== OFFLINE_CACHE && cacheName !== API_CACHE) {
              console.log('🗑️ Eliminando cache antiguo:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('💕 Service Worker activado y listo');
        return self.clients.claim();
      })
  );
});

// Interceptar requests (estrategia de cache)
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Solo manejar requests HTTP/HTTPS
  if (request.url.startsWith('http')) {
    
    // Estrategia para API calls
    if (url.pathname.startsWith('/api/')) {
      event.respondWith(handleApiRequest(request));
    }
    // Estrategia para archivos estáticos
    else {
      event.respondWith(handleStaticRequest(request));
    }
  }
});

// Manejar requests de API
async function handleApiRequest(request) {
  const url = new URL(request.url);
  const method = request.method;
  
  try {
    // Para GET requests que se pueden cachear
    if (method === 'GET' && CACHEABLE_API_PATTERNS.some(pattern => pattern.test(url.pathname))) {
      
      // Intentar network primero, luego cache
      try {
        const networkResponse = await fetch(request.clone());
        
        if (networkResponse.ok) {
          // Guardar en cache para uso offline
          const cache = await caches.open(API_CACHE);
          await cache.put(request, networkResponse.clone());
          
          console.log('💕 API response cacheada:', url.pathname);
          return networkResponse;
        }
      } catch (error) {
        console.log('🔄 Network falló, buscando en cache:', url.pathname);
      }
      
      // Si network falla, buscar en cache
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        console.log('📱 Usando respuesta offline:', url.pathname);
        return cachedResponse;
      }
    }
    
    // Para otros requests (POST, PUT, etc.) siempre intentar network
    const networkResponse = await fetch(request);
    return networkResponse;
    
  } catch (error) {
    console.error('💔 Error en API request:', error);
    
    // Si es un GET, intentar respuesta offline genérica
    if (method === 'GET') {
      return new Response(
        JSON.stringify({
          error: 'Sin conexión',
          message: 'Esta función requiere conexión a internet',
          offline: true
        }),
        {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    throw error;
  }
}

// Manejar requests de archivos estáticos
async function handleStaticRequest(request) {
  try {
    // Cache First Strategy para archivos estáticos
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Si no está en cache, intentar network
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Cachear archivos estáticos exitosos
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('💔 Error en static request:', error);
    
    // Para navegación, devolver página principal desde cache
    if (request.destination === 'document') {
      const cachedIndex = await caches.match('/');
      if (cachedIndex) {
        return cachedIndex;
      }
    }
    
    // Respuesta offline genérica
    return new Response(
      `
      <html>
        <head>
          <title>LoveActs - Sin Conexión</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              background: linear-gradient(135deg, #fce7f3 0%, #ffffff 50%, #dbeafe 100%);
              display: flex; 
              align-items: center; 
              justify-content: center; 
              min-height: 100vh; 
              margin: 0; 
              text-align: center;
            }
            .offline-container {
              background: white;
              padding: 2rem;
              border-radius: 1rem;
              box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            }
            .emoji { font-size: 4rem; margin-bottom: 1rem; }
            h1 { color: #ec4899; margin-bottom: 0.5rem; }
            p { color: #6b7280; margin-bottom: 1.5rem; }
            button {
              background: linear-gradient(135deg, #ec4899, #3b82f6);
              color: white;
              border: none;
              padding: 0.75rem 2rem;
              border-radius: 0.5rem;
              font-weight: 600;
              cursor: pointer;
            }
            button:hover { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="offline-container">
            <div class="emoji">💕</div>
            <h1>LoveActs</h1>
            <h2>Sin Conexión a Internet</h2>
            <p>Parece que no tienes conexión. Algunas funciones pueden no estar disponibles.</p>
            <button onclick="window.location.reload()">🔄 Reintentar</button>
          </div>
        </body>
      </html>
      `,
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

// Manejar mensajes del cliente
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('💕 Activando nueva versión del Service Worker');
    self.skipWaiting();
  }
});

// Push notifications (para futuras implementaciones)
self.addEventListener('push', (event) => {
  console.log('💕 Push notification recibida');
  
  const options = {
    body: event.data ? event.data.text() : '¡Tu pareja tiene algo especial para ti! 💕',
    icon: '/images/icon-192x192.png',
    badge: '/images/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Ver LoveActs',
        icon: '/images/icon-128x128.png'
      },
      {
        action: 'close',
        title: 'Cerrar'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('LoveActs 💕', options)
  );
});

// Manejar clicks en notifications
self.addEventListener('notificationclick', (event) => {
  console.log('💕 Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('💕 LoveActs Service Worker v2.0 cargado exitosamente');