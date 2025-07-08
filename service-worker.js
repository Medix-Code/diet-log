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
  // Ignora peticions no-GET i de les extensions de Chrome
  if (
    event.request.method !== "GET" ||
    event.request.url.startsWith("chrome-extension://")
  ) {
    return;
  }

  // >>> PAS 1: Comprovem si la petició és per a un dels fitxers PRECACHE <<<
  // La URL de la petició pot ser absoluta, així que la convertim a una ruta relativa per comparar.
  const requestUrl = new URL(event.request.url);

  // Creem un objecte URL a partir de l'àmbit del SW per poder resoldre camins relatius.
  const scopeUrl = new URL(self.registration.scope);
  const relativePath = "./" + requestUrl.href.substring(scopeUrl.href.length);

  const isPrecachedFile =
    PRECACHE_FILES.includes(event.request.url) ||
    PRECACHE_FILES.includes(relativePath);

  // >>> PAS 2A: Si és un fitxer PRECACHE, apliquem "Cache First" <<<
  if (isPrecachedFile) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        // Si trobem la resposta al cache, la retornem.
        // Si no (la qual cosa seria rara si el precaching ha anat bé), anem a la xarxa com a fallback.
        return cachedResponse || fetch(event.request);
      })
    );
    return; // Important: acabem l'execució aquí
  }

  // >>> PAS 2B: Si NO és un fitxer PRECACHE, apliquem "Network First" <<<
  // Aquesta estratègia és ideal per a APIs, llibreries de CDN o qualsevol altre recurs
  // que vulguem que estigui el més actualitzat possible.
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si la resposta de la xarxa és bona, la guardem al cache per a futures ocasions offline.
        if (networkResponse && networkResponse.status === 200) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        // Si la resposta no és bona (p.ex. 404), la retornem sense desar-la.
        return networkResponse;
      })
      .catch(() => {
        // Si la xarxa falla, busquem al cache com a fallback.
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si tampoc està al cache, retornem un error.
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
