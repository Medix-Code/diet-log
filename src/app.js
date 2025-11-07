/**
 * Carrega les funcions bàsiques de l'app
 */
import { initializeApp } from "./init.js";
import { initPwaInstall } from "./services/pwaInstallHandler.js";
import { logger } from "./utils/logger.js";

// Components React incrementals (2025)
import { initReactComponents } from "./react-components.js";

const log = logger.withScope("App");

// Filtra warnings de React sobre touchmove (són benignes i esperades)
if (typeof console !== "undefined") {
  const originalWarn = console.warn;
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

// Constants per gestió d'errors
const MAX_RETRY_ATTEMPTS = 2;
let retryCount = 0;

/**
 * Mostra un error crític a l'usuari amb opcions de recuperació
 * @param {Error} error - L'error que s'ha produït
 * @param {boolean} canRetry - Si es pot reintentar
 */
function showCriticalError(error, canRetry = true) {
  log.error("Error crític en la inicialització de l'app:", error);

  // Crear el modal d'error si no existeix
  let errorModal = document.getElementById("critical-error-modal");
  if (!errorModal) {
    errorModal = document.createElement("div");
    errorModal.id = "critical-error-modal";
    errorModal.innerHTML = `
      <div style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        padding: 20px;
      ">
        <div style="
          background: white;
          border-radius: 8px;
          padding: 24px;
          max-width: 500px;
          width: 100%;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        ">
          <h2 style="margin: 0 0 16px 0; color: #d32f2f; font-size: 20px;">
            ⚠️ Error d'Inicialització
          </h2>
          <p style="margin: 0 0 16px 0; color: #333; line-height: 1.5;">
            L'aplicació no s'ha pogut inicialitzar correctament.
          </p>
          <details style="margin: 0 0 16px 0;">
            <summary style="cursor: pointer; color: #666; margin-bottom: 8px;">
              Detalls tècnics
            </summary>
            <pre style="
              background: #f5f5f5;
              padding: 12px;
              border-radius: 4px;
              overflow-x: auto;
              font-size: 12px;
              margin: 0;
            ">${error.name}: ${error.message}\n\n${error.stack || ""}</pre>
          </details>
          <div id="error-actions" style="display: flex; gap: 12px; flex-wrap: wrap;">
            ${
              canRetry
                ? `<button id="retry-button" style="
              flex: 1;
              padding: 12px 24px;
              background: #1976d2;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
            ">
              Reintentar
            </button>`
                : ""
            }
            <button id="reload-button" style="
              flex: 1;
              padding: 12px 24px;
              background: #757575;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
            ">
              Recarregar Pàgina
            </button>
          </div>
          <p style="margin: 16px 0 0 0; font-size: 12px; color: #666;">
            Si el problema persisteix, prova esborrar les dades del navegador o contacta amb suport.
          </p>
        </div>
      </div>
    `;
    document.body.appendChild(errorModal);

    // Event listeners
    const retryBtn = errorModal.querySelector("#retry-button");
    const reloadBtn = errorModal.querySelector("#reload-button");

    if (retryBtn) {
      retryBtn.addEventListener("click", () => {
        errorModal.remove();
        retryCount++;
        startApp();
      });
    }

    if (reloadBtn) {
      reloadBtn.addEventListener("click", () => {
        window.location.reload();
      });
    }
  }
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

    // Reset retry count si tot va bé
    retryCount = 0;
  } catch (error) {
    // Gestió d'errors millorada: mostrar informació a l'usuari
    // en lloc de fer reload automàtic
    const canRetry = retryCount < MAX_RETRY_ATTEMPTS;
    showCriticalError(error, canRetry);

    // Si s'han exhaurit els intents, no permetre més retries
    if (!canRetry) {
      log.error(
        `S'han exhaurit els ${MAX_RETRY_ATTEMPTS} intents de recuperació. ` +
          "L'usuari ha de recarregar manualment o contactar suport."
      );
    }
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
