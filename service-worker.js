// service-worker.js

// Aquesta variable serà actualitzada automàticament per el  workflow de GitHub Actions.
const VERSION = "__APP_VERSION__";

const APP_SHELL_CACHE_NAME = `misdietas-app-shell-${VERSION}`;
const DYNAMIC_CACHE_NAME = `misdietas-dynamic-${VERSION}`;

// =================================================================================
// 1. APP SHELL: Fitxers essencials per a la càrrega inicial.
// =================================================================================
const APP_SHELL_FILES = [
  "./", // L'arrel de l'aplicació
  "./index.html",
  "./css/main.css",
  "./manifest.json",
  "./assets/images/icons-512.png", // La icona principal
  "./assets/images/icons-192.png", // La icona secundària
  // ELS ARXIUS JAVASCRIPT PRINCIPALS ARA ELS GESTIONARÀ EL CACHE DINÀMIC
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
// A service-worker.js

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // No interceptis peticions que no siguin del nostre origen o que no siguin GET
  if (url.origin !== self.location.origin || request.method !== "GET") {
    return;
  }

  // Estratègia 1: Cache First per a l'App Shell (el que ja teníem a la llista)
  // Comprovem si la petició és per a un dels nostres fitxers base.
  const isAppShellRequest = APP_SHELL_FILES.some((file) =>
    url.pathname.endsWith(file.replace("./", "/"))
  );

  if (isAppShellRequest) {
    event.respondWith(
      caches.match(request, { cacheName: APP_SHELL_CACHE_NAME })
    );
    return;
  }

  // Estratègia 2: Network First per a fitxers JS i CSS importants
  // Si és un fitxer JS o CSS, intenta anar a la xarxa primer. Si falla, utilitza el cache.
  if (url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(() => {
            // Si la xarxa falla, intenta servir des del cache
            return cache.match(request);
          });
      })
    );
    return;
  }

  // Estratègia 3: Stale-While-Revalidate per a la resta (ex: icones, fonts)
  // Serveix ràpidament des del cache, però actualitza en segon pla.
  event.respondWith(
    caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        });
        // Retorna el del cache si existeix, si no, espera a la xarxa.
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
