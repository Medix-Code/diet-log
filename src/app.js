// Import core dependencies
import { initializeApp } from "./init.js";
import { initPwaInstall } from "./services/pwaInstallHandler.js";

/**
 * Starts the main application initialization process.
 * Handles FOUC (Flash of Unstyled Content) prevention and initializes core services.
 * This function ensures the app is ready for user interaction.
 * @async
 * @throws Will log errors to console if initialization fails.
 */
async function startApp() {
  try {
    // Fix FOUC by marking app as ready immediately
    document.body.classList.add("app-ready");
    document.body.classList.remove("no-js");

    // Initialize base application functionality
    await initializeApp();

    // Set up PWA installation prompts
    initPwaInstall();
  } catch (error) {
    console.error("Critical error during app startup:", error);
    // TODO: Consider implementing user-friendly error display for production
  }
}

/**
 * Initializes the app when DOM is ready.
 * Uses event listener or immediate execution based on document state.
 */
function initializeOnDOMReady() {
  const start = () => startApp();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

// Start the application initialization
initializeOnDOMReady();

// Log app module load status (development aid)
if (process.env.NODE_ENV !== "production") {
  console.log("App.js loaded, waiting for DOMContentLoaded to initialize...");
}
