// src/app.js

import { initializeApp } from "./init.js";
import { initPwaInstall } from "./services/pwaInstallHandler.js";

// Funció que s'executarà quan el DOM estigui llest
async function startApp() {
  try {
    await initializeApp();
    initPwaInstall();

    // ---FOUC FIX ---
    document.body.classList.add("app-ready");
  } catch (error) {
    console.error("Error crític en startApp:", error);
    document.body.classList.add("app-ready");
  }
}

// Quan el DOM estigui completament carregat, inicialitzem l'aplicació.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}

console.log("App.js carregat, esperant DOMContentLoaded per inicialitzar...");
