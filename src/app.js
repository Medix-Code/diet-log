// Carrega les funciones bàsiques de l'app
import { initializeApp } from "./init.js";
import { initPwaInstall } from "./services/pwaInstallHandler.js";

// Inicia l'aplicació principal
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

// Espera que el DOM estigui llest per iniciar
function initializeOnDOMReady() {
  const start = () => startApp();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
}

// Llança la inicialització de l'app
initializeOnDOMReady();

// Per debug, mostra quan es carrega l'app (només dev)
if (process.env.NODE_ENV !== "production") {
  console.log("App.js carregat, esperant DOMContentLoaded per inicialitzar...");
}
