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
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.open(DYNAMIC_CACHE_NAME).then(async (cache) => {
      try {
        // 1. Intenta anar a la xarxa primer
        const networkResponse = await fetch(event.request);

        // 2. Si funciona, guarda una còpia al cache i retorna la resposta de la xarxa
        // Només cachegem peticions GET correctes
        if (event.request.method === "GET" && networkResponse.ok) {
          cache.put(event.request, networkResponse.clone());
        }

        return networkResponse;
      } catch (error) {
        // 3. Si la xarxa falla, busca al cache
        console.log(
          `[ServiceWorker] La xarxa ha fallat per a ${event.request.url}, buscant al cache...`
        );
        const cachedResponse = await cache.match(event.request);

        // Si trobem una resposta al cache, la retornem.
        // Si no, l'error continuarà (la qual cosa és correcte si el recurs mai s'ha visitat)
        return cachedResponse;
      }
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
