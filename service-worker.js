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
  "./src/ui/saveIndicator.js",

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
  "./assets/icons/ic_ocr.svg",
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
  console.log("[ServiceWorker] Iniciant instal·lació...");

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log(
        "[ServiceWorker] Precaching fitxers essencials un per un per a depuració..."
      );

      let allOk = true;
      // Usem un bucle 'for...of' per poder fer 'await' a dins
      for (const url of PRECACHE_FILES) {
        try {
          // Intentem afegir cada fitxer individualment
          await cache.add(url);
        } catch (error) {
          // Si un fitxer falla, ho registrem a la consola
          console.error(
            `[ServiceWorker] ERROR: No s'ha pogut cachejar el fitxer: "${url}"`
          );
          console.error(error); // Mostrem l'error complet
          allOk = false; // Marquem que hi ha hagut un problema
        }
      }

      if (!allOk) {
        // Si algun fitxer ha fallat, fem que la instal·lació del SW falli explícitament.
        // Això evita que un SW a mitges quedi instal·lat.
        throw new Error(
          "La instal·lació ha fallat perquè un o més fitxers no s'han pogut cachejar."
        );
      }

      console.log("[ServiceWorker] Precaching completat amb èxit.");
      return self.skipWaiting();
    })
  );
});

// --- FETCH ---
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // >>> PAS 1: Comprovem si la petició és al nostre propi domini <<<
  // Si l'origen de la URL de la petició és diferent de l'origen del nostre lloc web,
  // ignorem la petició i deixem que el navegador la gestioni.
  // Això evita problemes amb scripts de tercers com Cloudflare, Google Analytics, etc.
  if (requestUrl.origin !== self.location.origin) {
    // console.log(`[ServiceWorker] Ignorant petició a domini extern: ${requestUrl.origin}`);
    return;
  }

  // Ignora altres peticions que no siguin GET
  if (event.request.method !== "GET") {
    return;
  }

  // Estratègia: Stale-While-Revalidate (la que ja teníem, que és excel·lent)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((err) => {
            console.warn(
              `[ServiceWorker] La petició de xarxa per a ${event.request.url} ha fallat.`
            );
            // Si la xarxa falla i no tenim res al cache, retornarem un error
            if (!cachedResponse) {
              return new Response("Contingut no disponible offline.", {
                status: 503,
                statusText: "Service Unavailable",
              });
            }
          });

        // Retorna la resposta del cache si existeix, si no, espera la resposta de la xarxa.
        return cachedResponse || fetchPromise;
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
