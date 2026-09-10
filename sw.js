const CACHE_NAME = 'bryt-dgm-offline-v2.0.0';
// Make sure this path matches exactly where you saved your offline page!
const OFFLINE_URL = 'offline.html';

// 1. INSTALL EVENT: Cache the offline page immediately
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // We cache the offline page so it's ready when the network dies
            return cache.add(new Request(OFFLINE_URL, { cache: 'reload' }));
        })
    );
    self.skipWaiting();
});

// 2. ACTIVATE EVENT: Clean up old caches and take control
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    event.waitUntil(clients.claim());
});

// 3. SMART FETCH EVENT: The magic that protects Supabase
self.addEventListener('fetch', (event) => {
    
    // Check if the request is a "navigate" request (meaning the user is trying to load an HTML page)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // If the network fetch fails (because they are offline), serve the cached offline.html
                return caches.match(OFFLINE_URL);
            })
        );
        return; // Stop here. Do not process this request any further.
    }

    // FOR EVERYTHING ELSE (Supabase APIs, Images, CSS, JS):
    // Do absolutely nothing. Let the request pass through to the internet normally.
    // This completely prevents the Service Worker from breaking your database!
});