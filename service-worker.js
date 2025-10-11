// =================================================================================
// SERVICE WORKER - MISDIETAS
// Estratègies de cache optimitzades per PWA
// =================================================================================

// Versió actual de l'app
const VERSION = "1.4.1";

// Noms dels caches amb versionat
const CACHE_NAMES = {
  APP_SHELL: `misdietas-app-shell-${VERSION}`,
  ASSETS: `misdietas-assets-${VERSION}`,
  FONTS: `misdietas-fonts-${VERSION}`,
  IMAGES: `misdietas-images-${VERSION}`,
  EXTERNAL: `misdietas-external-${VERSION}`,
};

// =================================================================================
// 1. APP SHELL: Fitxers essencials per a la càrrega inicial.
// =================================================================================
const APP_SHELL_FILES = [
  "./",
  "./index.html",
  "./privacy-policy.html",
  "./sw-register.js",
  "./css/main.css",
  "./css/main.min.css",
  "./manifest.json",
  "./src/app.js",
  "./src/init.js",
  "./src/ui/saveIndicator.js",
  "./src/ui/theme.js",
  "./src/ui/tabs.js",
  "./src/services/formService.js",
  "./src/services/dietService.js",
  "./src/services/servicesPanelManager.js",
];

// =================================================================================
// 2. ASSETS ESTÀTICS: Icons i imatges essencials
// =================================================================================
const STATIC_ASSETS = [
  "./assets/icons/moon.svg",
  "./assets/icons/sun.svg",
  "./assets/icons/gear.svg",
  "./assets/icons/info.svg",
  "./assets/icons/donation.svg",
  "./assets/icons/download_blue.svg",
  "./assets/icons/save_green.svg",
  "./assets/icons/save.svg",
  "./assets/icons/error_red.svg",
  "./assets/icons/check_green.svg",
  "./assets/icons/camera.svg",
  "./assets/icons/gallery.svg",
];

// =================================================================================
// 3. IMATGES PRINCIPALS DEL MANIFEST
// =================================================================================
const MANIFEST_IMAGES = [
  "./assets/images/icons-512.png",
  "./assets/images/icons-192.png",
  "./assets/images/icons-512-maskable.png",
  "./assets/images/icons-192-maskable.png",
  "./assets/images/screenshot-desktop.png",
  "./assets/images/screenshot-mobile.png",
];

// =================================================================================
// 4. PATRONS PER CATEGORIZAR REQUESTS
// =================================================================================
const CACHE_PATTERNS = {
  // App Shell - Cache First, fallback a network
  APP_SHELL: /\.(html|js|css)$/,

  // Assets estàtics - Cache First amb fallback
  ASSETS: /\.(svg|png|jpg|jpeg|webp)$/,

  // Fonts externes - Network First amb long cache
  FONTS: /\.(woff2?|ttf|eot)$/,

  // APIs externes - Network Only (no cache)
  EXTERNAL_API: /(unpkg\.com|jsdelivr\.net|fonts\.googleapis\.com)/,
};

// =================================================================================
// 5. ESTRATÈGIES DE CACHE
// =================================================================================

/**
 * Estratègia Cache First: Retorna cache, falla a network
 * Ideal per assets estàtics que no canvien
 */
async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.warn(`[SW] Cache First failed for ${request.url}:`, error);
    throw error;
  }
}

/**
 * Estratègia Network First: Prova network, falla a cache
 * Ideal per contingut dinàmic o interfaces d'usuari
 */
async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log(`[SW] Network failed, trying cache for ${request.url}`);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

/**
 * Estratègia Stale While Revalidate: Retorna cache immediat, actualitza en background
 * Ideal per actualitzacions no crítiques
 */
async function staleWhileRevalidate(request, cacheName) {
  const cachedResponse = await caches.match(request);

  // Inicia fetch en background
  const fetchPromise = fetch(request)
    .then(async (networkResponse) => {
      if (networkResponse.ok) {
        const cache = await caches.open(cacheName);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.warn(`[SW] SWR fetch failed for ${request.url}:`, error);
      return cachedResponse; // fallback al cache
    });

  // Retorna cache immediat o espera network
  return cachedResponse || fetchPromise;
}

/**
 * Determina la millor estratègia pel request
 */
function getCacheStrategy(request, url) {
  const requestPath = "." + url.pathname;

  // App Shell files - Network First (sempre actualitzats)
  if (APP_SHELL_FILES.includes(requestPath)) {
    return () => networkFirst(request, CACHE_NAMES.APP_SHELL);
  }

  // Static assets - Cache First
  if (
    STATIC_ASSETS.includes(requestPath) ||
    MANIFEST_IMAGES.includes(requestPath)
  ) {
    return () => cacheFirst(request, CACHE_NAMES.ASSETS);
  }

  // Fonts - Cache First amb long-term cache
  if (CACHE_PATTERNS.FONTS.test(requestPath)) {
    return () => cacheFirst(request, CACHE_NAMES.FONTS);
  }

  // APIs externes - Network Only (no cache)
  if (CACHE_PATTERNS.EXTERNAL_API.test(url.host)) {
    return () => fetch(request);
  }

  // Per defecte - Stale While Revalidate
  return () => staleWhileRevalidate(request, CACHE_NAMES.EXTERNAL);
}

// =================================================================================
// 6. GESTIÓ DE VERSIONS I NETEJA
// =================================================================================

/**
 * Neteja caches antigues mantenint només la versió actual
 */
async function cleanupOldCaches(currentVersion) {
  const cacheKeys = await caches.keys();
  const cachesToDelete = cacheKeys.filter((cacheName) => {
    // Elimina caches de versions anteriors i caches sense versió
    return (
      !cacheName.includes(currentVersion) ||
      (!cacheName.includes("app-shell") &&
        !cacheName.includes("assets") &&
        !cacheName.includes("fonts") &&
        !cacheName.includes("images") &&
        !cacheName.includes("external"))
    );
  });

  console.log(
    `[SW] Eliminant ${cachesToDelete.length} caches antics:`,
    cachesToDelete
  );

  return Promise.all(
    cachesToDelete.map((cacheName) => caches.delete(cacheName))
  );
}

/**
 * Cache preload amb gestió d'errors detallada
 */
async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAMES.APP_SHELL);
  console.log(`[SW] Cachejant App Shell v${VERSION}...`);

  for (const file of APP_SHELL_FILES) {
    try {
      const response = await fetch(file, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      await cache.put(file, response);
      console.log(`[SW] ✓ Cachejat: ${file}`);
    } catch (error) {
      console.error(`[SW] ✗ Error cachejant ${file}:`, error);
      throw error;
    }
  }
}

// =================================================================================
// 7. LIFECYCLE EVENTS
// =================================================================================

// --- INSTALL EVENT ---
self.addEventListener("install", (event) => {
  console.log(`[SW] Instal·lant versió: ${VERSION}`);

  event.waitUntil(
    (async () => {
      try {
        // Cache App Shell i assets essencials
        await Promise.all([cacheAppShell(), cacheStaticAssets()]);

        console.log(`[SW] ✓ Instal·lació completada v${VERSION}`);
        return self.skipWaiting();
      } catch (error) {
        console.error(`[SW] ✗ Error durant instal·lació:`, error);
        throw error;
      }
    })()
  );
});

// --- ACTIVATE EVENT ---
self.addEventListener("activate", (event) => {
  console.log(`[SW] Activant versió: ${VERSION}`);

  event.waitUntil(
    (async () => {
      try {
        // Neteja caches antigues
        await cleanupOldCaches(VERSION);

        // Reclama tots els clients immediatament
        await self.clients.claim();

        console.log(`[SW] ✓ Activació completada v${VERSION}`);
      } catch (error) {
        console.error(`[SW] ✗ Error durant activació:`, error);
        throw error;
      }
    })()
  );
});

// --- FETCH EVENT ---
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Només gestiona requests GET del mateix origen
  if (url.origin !== self.location.origin || request.method !== "GET") {
    return;
  }

  // Obté l'estratègia adequada pel request
  const cacheStrategy = getCacheStrategy(request, url);

  // Respon amb l'estratègia seleccionada
  event.respondWith(cacheStrategy());
});

// =================================================================================
// 8. FUNCIONS AUXILIARS ADDICIONALS
// =================================================================================

/**
 * Cache d'assets estàtics
 */
async function cacheStaticAssets() {
  await Promise.all([
    cacheFileList(STATIC_ASSETS, CACHE_NAMES.ASSETS, "Static Assets"),
    cacheFileList(MANIFEST_IMAGES, CACHE_NAMES.IMAGES, "Manifest Images"),
  ]);
}

/**
 * Cache una llista de fitxers amb logging detallat
 */
async function cacheFileList(fileList, cacheName, description) {
  if (!fileList.length) return;

  const cache = await caches.open(cacheName);
  console.log(`[SW] Cachejant ${description}...`);

  for (const file of fileList) {
    try {
      const response = await fetch(file, { cache: "no-cache" });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      await cache.put(file, response);
      console.log(`[SW] ✓ ${file}`);
    } catch (error) {
      console.error(`[SW] ✗ Error cachejant ${file}:`, error);
      throw error;
    }
  }
}

// --- GESTOR D'ERRORS GLOBAL ---
self.addEventListener("error", (event) => {
  console.error("[ServiceWorker] Error global capturat:", event.error);
});

self.addEventListener("controllerchange", () => {
  console.log("[ServiceWorker] Nou controlador actiu - Actualització forçada.");
});
