// service-worker.js

// Nom del caché principal (incrementa la versió si canvies PRECACHE_FILES)
const CACHE_NAME = "dieta-cache-vDEV"; // <-- Incrementat per reflectir canvis

// Fitxers essencials per a la funcionalitat offline inicial (App Shell)
const PRECACHE_FILES = [
  "./", // Necessari per a la navegació a l'arrel
  "./index.html",
  "./css/main.css",
  "./manifest.json",
  // Scripts absolutament necessaris per arrencar i mostrar la UI inicial
  "./src/app.js",
  "./src/init.js",
  "./src/utils/utils.js", // Probablement usat per init.js (setTodayDate, etc.)
  "./src/ui/tabs.js", // Necessari per configurar les pestanyes a l'inici
  "./src/ui/toast.js", // Probablement necessari per mostrar errors/avisos aviat
  "./src/db/indexedDbDietRepository.js", // Necessari per cridar openDatabase a l'inici
  "./src/services/servicesPanelManager.js", // Cridat per initServices a l'inici
  "./src/services/formService.js", // Cridat per init.js per listeners/estat inicial
  "./src/services/signatureService.js", // Cridat per initSignature a l'inici
  "./src/ui/theme.js", // Cridat per initThemeSwitcher a l'inici

  // Icones principals
  "./assets/images/icons-192.png",
  "./assets/images/icons-512.png",
  "./assets/images/icons-192-maskable.png", // Important per a millor aparença
  "./assets/images/icons-512-maskable.png",

  // Altres icones usades a la UI principal (si són crítiques)
  "./assets/icons/moon.svg",
  "./assets/icons/sun.svg",
  "./assets/icons/signature.svg",
  "./assets/icons/signature_ok.svg",
  "./assets/icons/save_green.svg",
  "./assets/icons/download_blue.svg",
  "./assets/icons/gear.svg",
  "./assets/icons/submenu.svg",
  "./assets/icons/save_white.svg",
  "./assets/icons/id_card.svg",
  // ... ( altres icones SVG/PNG essencials)
];

// Fitxers no essencials per a la primera càrrega o que es volen actualitzar sovint
const RUNTIME_FILES = [
  // Plantilles PDF (poden ser grans)
  "./dieta_tsc.pdf",
  // Llibreries externes (carregades des de CDN o localment)
  "https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js",
  "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.0/dist/tesseract.min.js", // Si s'usa des de CDN

  // Mòduls JS carregats més tard o menys crítics per a l'inici
  "./src/models/diet.js", // Model de dades, potser no cal a l'inici
  "./src/services/dietService.js", // Usat en desar/carregar/eliminar
  "./src/services/dotacion.js", // Gestiona dotacions, usat en desar/carregar
  "./src/services/pdfService.js", // Usat només en generar PDF
  "./src/services/cameraOcr.js", // Usat només en activar OCR
  "./src/services/pwaService.js", // Gestiona PWA, pot carregar-se una mica després
  "./src/ui/clearService.js", // Configuració del botó d'esborrar
  "./src/ui/mainButtons.js", // Configuració botons menú (depèn de quan es munta)
  "./src/ui/modals.js", // Lògica de modals genèrics/específics
  "./src/ui/pickers.js", // Configuració de pickers
  "./src/ui/settingsPanel.js", // Configuració del panell d'ajustos
  "./src/utils/restrictions.js", // Restriccions d'input
  "./src/utils/validation.js", // Funcions de validació

  // Altres assets que no siguin crítics inicialment (p.ex., altres icones menys usades)
  "./assets/icons/eraser.svg",
  "./assets/icons/ocr.svg",
  "./assets/icons/delete.svg",
  "./assets/icons/upload.svg",
  "./assets/icons/info.svg",
  "./assets/icons/donation.svg",
  "./assets/icons/egg.svg",
  "./assets/icons/camera.svg",
  "./assets/icons/gallery.svg",
];

// --- INSTALL ---
self.addEventListener("install", (event) => {
  console.log("[ServiceWorker] Instal·lant...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log(
          "[ServiceWorker] Precaching fitxers essencials:",
          PRECACHE_FILES
        );
        // Usem addAll, que falla si algun fitxer no es pot descarregar
        return cache.addAll(PRECACHE_FILES).catch((error) => {
          console.error("[ServiceWorker] Error durant el precaching:", error);
          // Podríem intentar cachejar individualment per depurar quin falla
          // PRECACHE_FILES.forEach(file => {
          //     cache.add(file).catch(err => console.warn(`No s'ha pogut cachejar ${file}:`, err));
          // });
          // O simplement llançar l'error per fer fallar la instal·lació si un fitxer crític falla
          throw error;
        });
      })
      .then(() => {
        console.log("[ServiceWorker] Precaching completat.");
      })
  );
  self.skipWaiting(); // Activa el nou SW més ràpid
});

// --- FETCH ---
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Ignora peticions que no siguin GET (POST, PUT, etc.)
  if (event.request.method !== "GET") {
    // console.log(`[ServiceWorker] Ignorant petició no-GET: ${event.request.method} ${requestUrl.pathname}`);
    return;
  }

  // Ignora peticions a extensions de Chrome o eines de desenvolupament
  if (requestUrl.protocol.startsWith("chrome-extension:")) {
    return;
  }

  // Estratègia: Network First per als RUNTIME_FILES
  // Comprova si la ruta de la petició coincideix parcialment amb alguna URL de RUNTIME_FILES
  const isRuntimeFile = RUNTIME_FILES.some((runtimeUrl) => {
    // Compara només el pathname per a recursos locals
    if (
      !runtimeUrl.startsWith("http") &&
      !requestUrl.protocol.startsWith("http")
    ) {
      return requestUrl.pathname.endsWith(runtimeUrl.substring(1)); // Compara pathnames relatius
    }
    // Compara URLs completes per a recursos externs
    return requestUrl.href === runtimeUrl;
  });

  if (isRuntimeFile) {
    // console.log(`[ServiceWorker] Fetch (NetworkFirst): ${requestUrl.pathname}`);
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // Comprova si la resposta és vàlida abans de cachejar
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            // Desa una còpia al cache per a ús offline futur
            return caches.open(CACHE_NAME).then((cache) => {
              // console.log(`[ServiceWorker] Cachejant ${requestUrl.pathname} des de xarxa.`);
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          }
          // Si la resposta de xarxa no és vàlida, la retornem igualment
          // però no la desem al cache.
          return networkResponse;
        })
        .catch(() => {
          // Si falla la xarxa, intenta obtenir del cache
          // console.warn(`[ServiceWorker] Xarxa fallida per ${requestUrl.pathname}, intentant cache...`);
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              //   console.log(`[ServiceWorker] Servint ${requestUrl.pathname} des de cache.`);
              return cachedResponse;
            }
            // Si tampoc està al cache, retorna un error (o una pàgina offline genèrica)
            console.error(
              `[ServiceWorker] Fallada de xarxa i ${requestUrl.pathname} no trobat al cache.`
            );
            return new Response("Contingut no disponible offline.", {
              status: 404,
              statusText: "Not Found Offline",
            });
          });
        })
    );
    return; // Acaba aquí per als runtime files
  }

  // Estratègia: Cache First per a la resta (inclou PRECACHE_FILES i navegació)
  //   console.log(`[ServiceWorker] Fetch (CacheFirst): ${requestUrl.pathname}`);
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // console.log(`[ServiceWorker] Servint ${requestUrl.pathname} des de cache.`);
        return cachedResponse;
      }

      // Si no està al cache, anem a la xarxa
      //   console.log(`[ServiceWorker] ${requestUrl.pathname} no al cache, intentant xarxa...`);
      return fetch(event.request)
        .then((networkResponse) => {
          // Opcional: Podríem cachejar aquí també els recursos no-runtime que es demanen?
          // Depèn de si vols que el cache creixi amb l'ús o només contingui els predefinits.
          // Per ara, no els desem per mantenir el cache més controlat.
          // if (networkResponse && networkResponse.status === 200) {
          //     caches.open(CACHE_NAME).then(cache => {
          //         cache.put(event.request, networkResponse.clone());
          //     });
          // }
          return networkResponse;
        })
        .catch((error) => {
          console.error(
            `[ServiceWorker] Error durant el fetch (CacheFirst) per ${requestUrl.pathname}:`,
            error
          );
          // Retorna un error genèric si falla la xarxa i no estava al cache
          // Podria retornar una pàgina offline personalitzada aquí
          // return caches.match('/offline.html');
          return new Response("Error de xarxa o recurs no trobat.", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
    })
  );
});

// --- ACTIVATE ---
self.addEventListener("activate", (event) => {
  console.log("[ServiceWorker] Activant...");
  const cacheWhitelist = [CACHE_NAME]; // Només el cache actual és vàlid

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!cacheWhitelist.includes(cacheName)) {
              console.log("[ServiceWorker] Eliminant caché antic:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[ServiceWorker] Caches antics eliminats.");
        return self.clients.claim(); // Reclama clients immediatament
      })
  );
});

// --- ERROR ---
self.addEventListener("error", (event) => {
  console.error("[ServiceWorker] Error capturat:", event.message, event);
});

// --- MESSAGE (Opcional, per a comunicació amb la pàgina) ---
// self.addEventListener('message', (event) => {
//   if (event.data && event.data.type === 'SKIP_WAITING') {
//     self.skipWaiting();
//   }
// });
