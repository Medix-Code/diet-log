const VERSION = "2.1.5";
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
    "f642d613f6acd78db136c5bc4b81c42d052a377a14b7369eafc8938b8493dd0b1e0d3058ab4c7a6eb4b4d7148e5e50c9",
  "/css/main.min.css?v=2.3.4":
    "3a9d4cb9b12879f457835e2230e8ba7cc25f8357accd56514d1cb5466b2e4bf4004f51aa4a91b9246e335362dda29e72",
};

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function enforceIntegrity(request, response) {
  const url = new URL(request.url);
  const key = `${url.pathname}${url.search}`;
  const expectedHash = RESOURCE_INTEGRITY[key];
  if (!expectedHash) {
    return response;
  }

  const hashBuffer = await crypto.subtle.digest(
    "SHA-384",
    await response.clone().arrayBuffer()
  );
  const actualHash = bufferToHex(hashBuffer);
  if (actualHash !== expectedHash) {
    throw new Error(
      `[SW] Integrity check failed for ${key}. Expected ${expectedHash} but got ${actualHash}.`
    );
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

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  const response = await fetch(request);
  const verifiedResponse = await enforceIntegrity(request, response);
  cache.put(request, verifiedResponse.clone());
  return verifiedResponse;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    const verifiedResponse = await enforceIntegrity(request, response);
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
