// keyboardHandler.js
const savePill = document.getElementById("save-pill"); // O el teu ID
let initialViewportHeight = window.innerHeight; // Alçada inicial sense teclat
let keyboardHeight = 0;
let isKeyboardOpen = false;

// Funció per ajustar la posició
function adjustPillPosition() {
  if (isKeyboardOpen && keyboardHeight > 0) {
    savePill.style.bottom = `${keyboardHeight + 20}px`; // 20px de marge per sobre del teclat
  } else {
    savePill.style.bottom = "calc(20px + env(safe-area-inset-bottom, 0px))"; // Posició original
  }
}

// Detecció amb Visual Viewport API (millor per Android modern)
if ("visualViewport" in window) {
  window.visualViewport.addEventListener("resize", () => {
    const viewport = window.visualViewport;
    keyboardHeight = initialViewportHeight - viewport.height;
    isKeyboardOpen = keyboardHeight > 100; // Threshold per evitar falsos positius (ex: zoom)
    adjustPillPosition();
  });
} else {
  // Fallback per browsers antics: Escucha resize
  window.addEventListener("resize", () => {
    const newHeight = window.innerHeight;
    keyboardHeight = initialViewportHeight - newHeight;
    isKeyboardOpen =
      keyboardHeight > 100 && document.activeElement.tagName === "INPUT"; // Només si hi ha un input focusat
    adjustPillPosition();
    initialViewportHeight = newHeight; // Actualitza per rotacions
  });
}

// Inicialitza al load
window.addEventListener("load", () => {
  initialViewportHeight = window.innerHeight;
});

// Opcional: Escucha focus/blur en inputs per més precisió
document.addEventListener("focusin", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    setTimeout(adjustPillPosition, 100); // Delay per donar temps al teclat
  }
});
document.addEventListener("focusout", adjustPillPosition);
