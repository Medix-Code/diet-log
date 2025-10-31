// Registers the PWA service worker and logs lifecycle events for debugging.
const SW_PATH = "/service-worker.js";

const isLocalhost = Boolean(
  window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.endsWith(".local")
);

function logInfo(...args) {
  if (isLocalhost) {
    console.info("[SW]", ...args);
  }
}

function logError(...args) {
  console.error("[SW]", ...args);
}

async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register(SW_PATH);
    logInfo("Registered with scope:", registration.scope);

    // Reload the page once the updated worker takes control.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      logInfo("Controller changed, reloading to activate updated worker.");
      window.location.reload();
    });

    // Inform waiting workers to activate immediately.
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    // Listen for new updates and activate them ASAP.
    registration.addEventListener("updatefound", () => {
      const installingWorker = registration.installing;
      if (!installingWorker) return;

      installingWorker.addEventListener("statechange", () => {
        if (installingWorker.state === "installed" && navigator.serviceWorker.controller) {
          logInfo("New version available; activating.");
          installingWorker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });
  } catch (error) {
    logError("Registration failed:", error);
  }
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", registerServiceWorker);
} else {
  logInfo("Service workers not supported by this browser.");
}
