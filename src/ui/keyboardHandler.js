// src/ui/keyboardHandler.js
const savePill = document.getElementById("save-pill"); // ID de la teva pastilla flotant
let initialViewportHeight = window.innerHeight; // Alçada inicial sense teclat
let keyboardHeight = 0;
let isKeyboardOpen = false;
const MARGIN_ABOVE_KEYBOARD = 10; // Marge mínim per "arran" al teclat (ajusta aquí: 5-15px per consistència)
const THRESHOLD = 150; // Threshold més alt per evitar errors en dispositius amb barres variables

// Funció per ajustar la posició amb precisió
function adjustPillPosition() {
  if (isKeyboardOpen && keyboardHeight > THRESHOLD) {
    // Ajust exacte: keyboardHeight + marge + safe-area (via CSS fallback)
    savePill.style.bottom = `calc(${keyboardHeight}px + ${MARGIN_ABOVE_KEYBOARD}px + env(safe-area-inset-bottom, 0px))`;
  } else {
    // Posició original: 20px + safe-area
    savePill.style.bottom = `calc(20px + env(safe-area-inset-bottom, 0px))`;
  }
}

// Detecció amb Visual Viewport API (prioritat per precisió en mòbils moderns)
if ("visualViewport" in window) {
  window.visualViewport.addEventListener("resize", () => {
    const viewport = window.visualViewport;
    keyboardHeight = initialViewportHeight - viewport.height;
    isKeyboardOpen =
      keyboardHeight > THRESHOLD && document.activeElement?.tagName === "INPUT"; // Verifica focus en input
    adjustPillPosition();
  });
} else {
  // Fallback per browsers antics: resize event
  window.addEventListener("resize", () => {
    const newHeight = window.innerHeight;
    keyboardHeight = initialViewportHeight - newHeight;
    isKeyboardOpen =
      keyboardHeight > THRESHOLD && document.activeElement?.tagName === "INPUT";
    adjustPillPosition();
    if (!isKeyboardOpen) initialViewportHeight = newHeight; // Actualitza per rotacions o canvis
  });
}

// Inicialitza al load i actualitza initial height
window.addEventListener("load", () => {
  initialViewportHeight = window.innerHeight;
});

// Millora: Escucha focus/blur amb delay per esperar l'obertura del teclat
document.addEventListener("focusin", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    setTimeout(adjustPillPosition, 300); // Delay de 300ms per estabilitzar (ajusta si cal)
  }
});
document.addEventListener("focusout", () => {
  setTimeout(adjustPillPosition, 100); // Delay curt per tancament
});
