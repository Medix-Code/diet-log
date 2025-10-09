/**
 * Carrega les funcions bàsiques de l'app
 */
import { initializeApp } from "./init.js";
import { initPwaInstall } from "./services/pwaInstallHandler.js";

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
  } catch (error) {
    console.error("Critical error during app startup:", error);
    // TODO: Consider implementing user-friendly error display for production
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
