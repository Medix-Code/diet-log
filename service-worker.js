const VERSION = "2.2.9";
const CACHE_PREFIX = "misdietas-cache";
const CACHE_NAME = `${CACHE_PREFIX}-v${VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/main.min.css?v=2.3.4",
  "/dist/bundle.js?v=2.5.3",
  "/assets/images/icons-192.png",
  "/assets/images/icons-512.png",
  "/assets/images/icons-192-maskable.png",
  "/assets/images/icons-512-maskable.png",
  "/assets/icons/moon.svg",
  "/assets/icons/sun.svg",
];

const STATIC_EXTENSIONS = [
  ".js",
  ".css",
  ".png",
  ".svg",
  ".jpg",
  ".jpeg",
  ".webp",
  ".json",
  ".ico",
];
const RESOURCE_INTEGRITY = {
  "/dist/bundle.js?v=2.5.3":
    "aff69a2466ea411177f7faa19277943f26eeb2d69bd61dff81d3353eda967a3846c9428d69737e2e6999336b10a8dcfa",
  "/css/main.min.css?v=2.3.4":
    "ef84827a5debb77dcc2be44820558e8e6e456e5ea581384fb88e224bec6f4d15fdb32e90fe711e227d18e40a085d4189",
};

// Tracking d'errors d'integritat per evitar loops
const integrityErrors = new Map();
const MAX_INTEGRITY_ERRORS = 3;

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Valida la integritat d'una resposta amb fallback graceful
 * Si falla la validació, loggeja l'error però retorna la resposta igualment
 * per no bloquejar l'aplicació completament
 */
async function enforceIntegrity(request, response, options = {}) {
  const { strict = false } = options;
  const url = new URL(request.url);
  const key = `${url.pathname}${url.search}`;
  const expectedHash = RESOURCE_INTEGRITY[key];

  // Si no hi ha hash esperat, no cal validar
  if (!expectedHash) {
    return response;
  }

  try {
    const hashBuffer = await crypto.subtle.digest(
      "SHA-384",
      await response.clone().arrayBuffer()
    );
    const actualHash = bufferToHex(hashBuffer);

    if (actualHash !== expectedHash) {
      // Incrementar contador d'errors
      const errorCount = (integrityErrors.get(key) || 0) + 1;
      integrityErrors.set(key, errorCount);

      const errorMsg = `[SW] Integrity check failed for ${key}. Expected ${expectedHash.slice(0, 16)}... but got ${actualHash.slice(0, 16)}... (attempt ${errorCount}/${MAX_INTEGRITY_ERRORS})`;

      console.warn(errorMsg);

      // Si és mode strict i s'han exhaurit els intents, llançar error
      if (strict && errorCount >= MAX_INTEGRITY_ERRORS) {
        throw new Error(errorMsg + " - Blocking resource in strict mode");
      }

      // Fallback graceful: retornar la resposta igualment amb warning
      console.warn(`[SW] FALLBACK: Serving ${key} despite integrity failure`);
      return response;
    } else {
      // Reset contador si la validació és exitosa
      integrityErrors.delete(key);
    }
  } catch (error) {
    console.error(`[SW] Error checking integrity for ${key}:`, error);
    // En cas d'error en la validació, retornar la resposta original
    return response;
  }

  return response;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            const request = new Request(url, { cache: "no-cache" });
            const response = await fetch(request);
            const verifiedResponse = await enforceIntegrity(request, response);
            await cache.put(request, verifiedResponse.clone());
          } catch (error) {
            console.warn("[SW] Precache failed for:", url, error);
          }
        })
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  // Skip cross-origin requests.
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (STATIC_EXTENSIONS.some((ext) => requestUrl.pathname.endsWith(ext))) {
    event.respondWith(cacheFirst(request));
  }
});

/**
 * Retry logic amb exponential backoff per fetch
 * @param {Request} request - La petició a fer
 * @param {number} maxRetries - Nombre màxim d'intents
 * @returns {Promise<Response>} La resposta o throw error
 */
async function fetchWithRetry(request, maxRetries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(request);
      if (response.ok || response.status === 304) {
        return response;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(
          `[SW] Fetch failed for ${request.url}, retry ${attempt + 1}/${maxRetries} after ${delay}ms`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetchWithRetry(request);
    const verifiedResponse = await enforceIntegrity(request, response);
    cache.put(request, verifiedResponse.clone());
    return verifiedResponse;
  } catch (error) {
    console.error(`[SW] cacheFirst failed for ${request.url}:`, error);
    // Si tot falla, intentar tornar una resposta en cache genèrica
    const fallbackResponse = await cache.match(request);
    if (fallbackResponse) {
      console.warn(`[SW] Serving stale cache for ${request.url}`);
      return fallbackResponse;
    }
    throw error;
  }
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetchWithRetry(request);
    const verifiedResponse = await enforceIntegrity(request, response);
    cache.put(request, verifiedResponse.clone());
    return verifiedResponse;
  } catch (error) {
    console.warn(
      `[SW] networkFirst failed for ${request.url}, falling back to cache`,
      error
    );
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Última opció: retornar index.html per SPA routing
    return cache.match("/index.html");
  }
}
