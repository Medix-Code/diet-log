const VERSION = "2.4.0";
const CACHE_PREFIX = "misdietas-cache";
const CACHE_NAME = `${CACHE_PREFIX}-v${VERSION}`;

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/main.min.css?v=2.3.7",
  "/dist/bundle.js?v=2.5.5",
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
  "/dist/bundle.js?v=2.5.5":
    "86927eea4889ea03047a164bf2a6a2a16c7509058f39b68a33b7c14a17b0bca5809b8d7abe4f7c2eb3605d62dffeb1cc",
  "/css/main.min.css?v=2.3.6":
    "ba948216a3319bd36103ba7292baccf0fbf2572f29dbfea391fe90cf05e8e9f1572671c2f9d664a199a7f99bc5dafda2",
};

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function enforceIntegrity(request, response, options = {}) {
  const url = new URL(request.url);
  const key = `${url.pathname}${url.search}`;
  const expectedHash = RESOURCE_INTEGRITY[key];

  // Si no hi ha hash esperat, retornar resposta directament
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
      console.warn(
        `[SW] Integrity check failed for ${key}. Expected ${expectedHash} but got ${actualHash}.`
      );

      // Si estem en mode fallback, acceptar la resposta igualment
      if (options.allowFallback) {
        console.warn(
          `[SW] Acceptant resposta amb hash incorrecte (mode fallback)`
        );
        return response;
      }

      throw new Error(
        `[SW] Integrity check failed for ${key}. Expected ${expectedHash} but got ${actualHash}.`
      );
    }

    return response;
  } catch (error) {
    // Si la verificació falla i estem en mode fallback, retornar la resposta
    if (options.allowFallback) {
      console.warn(`[SW] Error verificant integritat, usant fallback:`, error);
      return response;
    }
    throw error;
  }
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

            // Primer intent: verificació estricta
            let verifiedResponse;
            try {
              verifiedResponse = await enforceIntegrity(request, response);
            } catch (integrityError) {
              console.warn(
                `[SW] Integrity check failed for ${url}, trying fallback...`
              );
              // Segon intent: amb fallback
              verifiedResponse = await enforceIntegrity(
                request,
                response.clone(),
                {
                  allowFallback: true,
                }
              );
            }

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

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  // Intentar verificar integritat amb fallback
  let verifiedResponse;
  try {
    verifiedResponse = await enforceIntegrity(request, response);
  } catch (integrityError) {
    console.warn(
      `[SW] Integrity check failed, using fallback for:`,
      request.url
    );
    verifiedResponse = await enforceIntegrity(request, response.clone(), {
      allowFallback: true,
    });
  }

  cache.put(request, verifiedResponse.clone());
  return verifiedResponse;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);

    // Intentar verificar integritat amb fallback
    let verifiedResponse;
    try {
      verifiedResponse = await enforceIntegrity(request, response);
    } catch (integrityError) {
      console.warn(
        `[SW] Integrity check failed, using fallback for:`,
        request.url
      );
      verifiedResponse = await enforceIntegrity(request, response.clone(), {
        allowFallback: true,
      });
    }

    cache.put(request, verifiedResponse.clone());
    return verifiedResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return cache.match("/index.html");
  }
}
