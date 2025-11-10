/**
 * Carrega les funcions bàsiques de l'app
 */
import { initializeApp } from "./init.js";
import { initPwaInstall } from "./services/pwaInstallHandler.js";

// Components React incrementals (2025)
import { initReactComponents } from "./react-components.js";

// Filtra warnings de React sobre touchmove (són benignes i esperades)
// Es pot desactivar definint window.__DISABLE_CONSOLE_WARN_FILTER = true
if (typeof console !== "undefined" && !window.__DISABLE_CONSOLE_WARN_FILTER) {
  const originalWarn = console.warn;

  // Guardar la funció original per poder restaurar-la
  window.__originalConsoleWarn = originalWarn;

  console.warn = function (...args) {
    const message = args[0];
    if (
      typeof message === "string" &&
      message.includes("Ignored attempt to cancel a touchmove event")
    ) {
      return; // Ignora aquest warning específic
    }
    originalWarn.apply(console, args);
  };

  // Funció per restaurar console.warn original
  window.__restoreConsoleWarn = function () {
    if (window.__originalConsoleWarn) {
      console.warn = window.__originalConsoleWarn;
      console.info("✅ console.warn restaurat a la funció original");
    }
  };
}

// Exporta les funcions OCR globalment per poder-les utilitzar des de l'HTML
import {
  getOCRFeedbackManager,
  createOCRFeedbackManager,
  destroyOCRFeedbackManager,
} from "./utils/ocrFeedbackBridge.js";

// Fa les funcions disponibles globalment
window.getOCRFeedbackManager = getOCRFeedbackManager;
window.createOCRFeedbackManager = createOCRFeedbackManager;
window.destroyOCRFeedbackManager = destroyOCRFeedbackManager;

/**
 * Mostra un error crític a l'usuari amb opció de recarregar
 */
function showCriticalError(error) {
  console.error("❌ Error crític inicialitzant l'aplicació:", error);

  // Crear modal d'error
  const errorModal = document.createElement("div");
  errorModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  `;

  errorModal.innerHTML = `
    <div style="background: white; padding: 30px; border-radius: 8px; max-width: 500px; text-align: center;">
      <h2 style="color: #d32f2f; margin-bottom: 16px;">⚠️ Error d'inicialització</h2>
      <p style="margin-bottom: 20px; color: #333;">
        L'aplicació no s'ha pogut inicialitzar correctament. Prova a recarregar la pàgina.
      </p>
      <p style="margin-bottom: 20px; color: #666; font-size: 14px;">
        Si el problema persisteix, contacta amb el suport tècnic. Les teves dietes estan guardades de forma segura.
      </p>
      <details style="margin-bottom: 20px; text-align: left;">
        <summary style="cursor: pointer; color: #666;">Detalls tècnics</summary>
        <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 12px; margin-top: 10px;">${error.message || error}</pre>
      </details>
      <button id="reload-btn" style="background: #004aad; color: white; border: none; padding: 12px 30px; border-radius: 4px; cursor: pointer; font-size: 16px;">
        Recarregar aplicació
      </button>
    </div>
  `;

  document.body.appendChild(errorModal);

  // Event listener
  document.getElementById("reload-btn").addEventListener("click", () => {
    window.location.reload();
  });
}

/**
 * Inicia l'aplicació principal de manera asíncrona
 */
async function startApp() {
  try {
    // Evita FOUC marcant que l'app està llesta
    document.body.classList.add("app-ready");
    document.body.classList.remove("no-js");

    // Inicialitza les coses bàsiques
    await initializeApp();

    // Prepara els prompts d'instal·lació PWA
    initPwaInstall();

    // Inicialitza components React incrementals (fallback-safe)
    initReactComponents();
  } catch (error) {
    // Mostrar error a l'usuari en lloc de recarregar automàticament
    showCriticalError(error);
  }
}

/**
 * Inicialitza l'app quan el DOM està llest, esperant DOMContentLoaded o executant immediatament
 */
function initializeOnDOMReady() {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startApp, { once: true });
  } else {
    startApp();
  }
}

// Llança la inicialització de l'app
initializeOnDOMReady();

// Per debug, mostra quan es carrega l'app (només dev)
if (process.env.NODE_ENV !== "production") {
  console.log("App.js carregat, esperant DOMContentLoaded per inicialitzar...");
}
