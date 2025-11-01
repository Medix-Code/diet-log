/**
 * Carrega les funcions bàsiques de l'app
 */
import { initializeApp } from "./init.js";
import { initPwaInstall } from "./services/pwaInstallHandler.js";

// Components React incrementals (2025)
import { initReactComponents } from "./react-components.js";

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
    // En cas d'error crític, recarregar la pàgina
    window.location.reload();
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
