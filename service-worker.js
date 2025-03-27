// Define a cache name, version it for updates
const CACHE_NAME = 'notes-pro-cache-v1.1'; // Increment version if you change cached files

// List of files to cache for offline use (the "app shell")
const CACHE_FILES = [
    '.', // Alias for index.html (or your start_url)
    'index.html',
    'styles.css',
    'script.js',
    'manifest.json',
    'resources/favicon.png',
    // External resources (use with caution - updates require SW update)
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/inter-ui/3.19.3/inter.min.css',
    // Add Font Awesome webfonts if needed (check network tab for exact paths)
    // e.g., 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/webfonts/fa-solid-900.woff2',
];

// --- Service Worker Installation ---
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    // Pre-cache app shell files
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching App Shell Files:', CACHE_FILES);
                // Use addAll for atomic caching (all succeed or all fail)
                return cache.addAll(CACHE_FILES);
            })
            .then(() => {
                console.log('[Service Worker] Installation successful, skipping waiting.');
                // Force the waiting service worker to become the active service worker.
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('[Service Worker] Caching failed during install:', error);
                // Optional: Throw error to indicate install failure
                // throw error;
            })
    );
});

// --- Service Worker Activation ---
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    // Clean up old caches
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // If the cache name is different from the current one, delete it
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Claiming clients.');
            // Take control of currently open pages immediately
            return self.clients.claim();
        })
    );
});

// --- Fetch Event Interception (Cache-First Strategy for App Shell) ---
self.addEventListener('fetch', (event) => {
    // console.log('[Service Worker] Fetching:', event.request.url);

    // Let browser handle non-GET requests (POST, PUT, DELETE etc.)
    // Or requests for extensions
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        // Don't intercept, let the browser handle it normally
        return;
    }

    // Cache-First strategy specifically for predefined app shell files
    // Check if the requested URL is one of the core files we decided to cache
    const requestUrl = new URL(event.request.url);
    // Need a robust way to check if the request is for a CACHE_FILE
    // Simple check based on path name (might need refinement based on your server setup)
    const isAppShellRequest = CACHE_FILES.some(fileUrl => {
        // Handle '.' as index.html or root
        if (fileUrl === '.') return requestUrl.pathname === '/' || requestUrl.pathname.endsWith('/index.html');
        // Handle full URLs vs relative paths
        try {
           const cacheFileUrl = new URL(fileUrl, self.location.origin);
           return requestUrl.href === cacheFileUrl.href;
        } catch(e) {
            // Handle relative paths
            return requestUrl.pathname.endsWith(fileUrl);
        }
    });

    if (isAppShellRequest) {
        // Cache-First for app shell: Try cache, then network
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    // console.log('[Service Worker] Serving from cache:', event.request.url);
                    return cachedResponse;
                }
                // console.log('[Service Worker] Not in cache, fetching from network:', event.request.url);
                return fetch(event.request); // Fetch from network if not in cache
            }).catch(error => {
                 console.error('[Service Worker] Error matching cache:', error);
                 // Optional: Provide a generic offline fallback page
                 // return caches.match('/offline.html');
            })
        );
    } else {
        // Network-First (or other strategy) for everything else (e.g., API calls, images not in shell)
        // For this simple notes app storing data in localStorage, we might just let non-shell requests pass through.
        // console.log('[Service Worker] Letting non-shell request pass through:', event.request.url);
        // If needed, you could implement Network-First here:
        /*
        event.respondWith(
            fetch(event.request).catch(() => {
                // Optional: Return a fallback if network fails for non-shell assets
                // return caches.match('/fallback-image.png');
            })
        );
        */
        // Or just don't call event.respondWith() for pass-through
        return;
    }
});
