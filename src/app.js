// src/app.js

import { initializeApp } from "./init.js";
import { initPwaInstall } from "./services/pwaInstallHandler.js";

// Funció que s'executarà quan el DOM estigui llest
async function startApp() {
  try {
    // ---FOUC FIX ---
    document.body.classList.add("app-ready");
    document.body.classList.remove("no-js");

    await initializeApp();
    initPwaInstall();
  } catch (error) {
    console.error("Error crític en startApp:", error);
    // Ja hem afegit "app-ready" al principi
  }
}

// Quan el DOM estigui completament carregat, inicialitzem l'aplicació.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}

console.log("App.js carregat, esperant DOMContentLoaded per inicialitzar...");
