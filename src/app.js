// src/app.js
// Punt d'entrada principal de l'aplicació.

import { initializeApp } from "./init.js";

// Quan el DOM estigui completament carregat, inicialitzem l'aplicació.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp(); // Si el DOM ja està carregat
}

console.log("App.js carregat, esperant DOMContentLoaded per inicialitzar...");
