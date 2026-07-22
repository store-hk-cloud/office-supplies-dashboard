// ═══════════════════════════════════════
// Service Worker — Office Supplies PWA v5.2
// ═══════════════════════════════════════
const CACHE_NAME = 'office-supplies-v5.2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/papaparse@5',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap'
];

// Install — cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('[SW] Cache install partial:', err.message);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate — cleanup old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch — network-first with cache fallback
self.addEventListener('fetch', event => {
  // Skip Supabase API calls
  if (event.request.url.includes('supabase.co') || event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    fetch(event.request).then(response => {
      if (response && response.status === 200 && event.request.method === 'GET') {
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
      }
      return response;
    }).catch(() => {
      return caches.match(event.request).then(cached => cached || new Response('คุณออฟไลน์ — กรุณาเชื่อมต่ออินเทอร์เน็ต', {
        status: 503,
        statusText: 'Offline',
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      }));
    })
  );
});