// src/app.js

import { initializeApp } from "./init.js";
import { initPwaInstall } from "./services/pwaInstallHandler.js";

// Funció que s'executarà quan el DOM estigui llest
async function startApp() {
  await initializeApp();
  initPwaInstall();
}

// Quan el DOM estigui completament carregat, inicialitzem l'aplicació.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}

console.log("App.js carregat, esperant DOMContentLoaded per inicialitzar...");
