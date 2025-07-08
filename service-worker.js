// service-worker.js

// Aquesta variable serà actualitzada automàticament pel teu workflow de GitHub Actions.
const VERSION = "20250708220350"; // Un valor inicial per a desenvolupament local

const APP_SHELL_CACHE_NAME = `misdietas-app-shell-${VERSION}`;
const DYNAMIC_CACHE_NAME = `misdietas-dynamic-${VERSION}`;

// =================================================================================
// 1. APP SHELL: Fitxers essencials per a la càrrega inicial.
// =================================================================================
const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./css/main.css",
  "./manifest.json",
  "./src/app.js",
  "./src/init.js",
  "./src/ui/saveIndicator.js",
  "./src/ui/theme.js",
  "./src/ui/tabs.js",
  "./src/services/formService.js",
  "./src/services/dietServices.js",
  "./src/services/servicesPanelManager.js",
  "./assets/images/icons-512.png",
  "./assets/images/icons-192.png",
  "./assets/icons/moon.svg",
  "./assets/icons/sun.svg",
  "./assets/icons/gear.svg",
  "./assets/icons/info.svg",
  "./assets/icons/donation.svg",
  "./assets/icons/download_blue.svg",
  "./assets/icons/save_green.svg",
];

// --- INSTALL ---
self.addEventListener("install", (event) => {
  console.log(`[ServiceWorker] Instal·lant versió: ${VERSION}`);
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE_NAME)
      .then((cache) => {
        console.log("[ServiceWorker] Fent precaching de la App Shell...");
        return cache.addAll(APP_SHELL_FILES);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error(
          "[ServiceWorker] La instal·lació de l'App Shell ha fallat:",
          error
        );
      })
  );
});

// --- ACTIVATE ---
self.addEventListener("activate", (event) => {
  console.log(`[ServiceWorker] Activant versió: ${VERSION}`);
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheName.endsWith(VERSION)) {
              console.log(
                `[ServiceWorker] Eliminant caché antic: ${cacheName}`
              );
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// --- FETCH ---
// --- FETCH ---
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignora peticions a dominis externs i no-GET
  if (url.origin !== self.location.origin || request.method !== "GET") {
    return;
  }

  // Construeix un camí relatiu a partir del pathname de la URL.
  const requestPath = "." + url.pathname;
  const isAppShellFile = APP_SHELL_FILES.includes(requestPath);

  // 2. Estratègia "Cache First, then Network" per a l'App Shell
  if (isAppShellFile) {
    event.respondWith(
      caches
        .match(request, { cacheName: APP_SHELL_CACHE_NAME })
        .then((response) => {
          // Si trobem el fitxer al cache, el retornem.
          // Si NO el trobem (response és null/undefined), intentem anar a la xarxa.
          return response || fetch(request);
        })
    );
    return;
  }

  // 3. Estratègia "Stale-While-Revalidate" per a la resta de recursos
  event.respondWith(
    caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        });

        return cachedResponse || fetchPromise;
      });
    })
  );
});

// --- GESTOR D'ERRORS GLOBAL ---
self.addEventListener("error", (event) => {
  console.error("[ServiceWorker] Error global capturat:", event.error);
});
