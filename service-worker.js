// service-worker.js

// Aquesta variable serà actualitzada automàticament per el  workflow de GitHub Actions.
const VERSION = "1.0.0";

const APP_SHELL_CACHE_NAME = `misdietas-app-shell-${VERSION}`;
const DYNAMIC_CACHE_NAME = `misdietas-dynamic-${VERSION}`;

// =================================================================================
// 1. APP SHELL: Fitxers essencials per a la càrrega inicial.
// =================================================================================
const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./sw-register.js",
  "./css/main.css",
  "./manifest.json",
  "./src/app.js",
  "./src/init.js",
  "./src/ui/saveIndicator.js",
  "./src/ui/theme.js",
  "./src/ui/tabs.js",
  "./src/services/formService.js",
  "./src/services/dietService.js",
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

// --- INSTALL  ---
self.addEventListener("install", (event) => {
  console.log(
    `[ServiceWorker-DEBUG] Iniciant instal·lació de la versió: ${VERSION}`
  );
  event.waitUntil(
    caches.open(APP_SHELL_CACHE_NAME).then(async (cache) => {
      console.log(
        "[ServiceWorker-DEBUG] Verificant fitxers de l'App Shell un per un..."
      );
      let allOk = true;

      for (const url of APP_SHELL_FILES) {
        try {
          await cache.add(url);
        } catch (error) {
          console.error(
            `===========================================================`
          );
          console.error(
            `[ServiceWorker-DEBUG] ERROR FATAL AL CACHEJAR EL FITXER:`
          );
          console.error(`>>> ${url} <<<`);
          console.error(
            `===========================================================`
          );
          allOk = false;
        }
      }

      if (!allOk) {
        throw new Error(
          "La instal·lació ha fallat. Revisa la consola per veure quin fitxer té un nom o camí incorrecte."
        );
      }

      console.log(
        "[ServiceWorker-DEBUG] Tots els fitxers de l'App Shell s'han cachejat correctament."
      );
      return self.skipWaiting();
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
      .then(() => self.clients.claim()) // Reclama clients immediatament per actualitzar
  );
});

// --- FETCH ---
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || request.method !== "GET") {
    return;
  }

  const requestPath = "." + url.pathname;
  const isAppShellFile = APP_SHELL_FILES.includes(requestPath);

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
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error(
              `[ServiceWorker-DEBUG] Error en fetch: ${error.message} per a ${request.url}`
            );
            // Opcional: Retorna cachedResponse si hi ha error de xarxa
            return cachedResponse;
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

self.addEventListener("controllerchange", () => {
  console.log("[ServiceWorker] Nou controlador actiu - Actualització forçada.");
});
