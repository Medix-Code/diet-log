// src/ui/keyboardHandler.js
const savePill = document.getElementById("save-pill");
let keyboardHeight = 0;
let isKeyboardOpen = false;
const MARGIN_ABOVE_KEYBOARD = 10;
const THRESHOLD = 150;

const scrollContainer = document.querySelector(".tab-content-container"); // Contenidor scrollable

function adjustPillPosition(height = keyboardHeight) {
  if (isKeyboardOpen && height > THRESHOLD) {
    savePill.style.bottom = `calc(${height}px + ${MARGIN_ABOVE_KEYBOARD}px + env(safe-area-inset-bottom, 0px))`;
  } else {
    savePill.style.bottom = `calc(20px + env(safe-area-inset-bottom, 0px))`;
  }
}
// Activa VirtualKeyboard API si disponible (millor pràctica per consistència)
if ("virtualKeyboard" in navigator) {
  const vk = navigator.virtualKeyboard;
  vk.overlaysContent = true; // Opta per overlay: teclat no resize viewport automàticament

  vk.addEventListener("geometrychange", (event) => {
    keyboardHeight = event.target.boundingRect.height;
    isKeyboardOpen = keyboardHeight > THRESHOLD;
    adjustPillPosition(keyboardHeight);
  });
} else {
  // Fallback per browsers sense API: Usa visualViewport o resize
  if ("visualViewport" in window) {
    window.visualViewport.addEventListener("resize", () => {
      keyboardHeight = window.innerHeight - window.visualViewport.height;
      isKeyboardOpen =
        keyboardHeight > THRESHOLD &&
        document.activeElement?.tagName === "INPUT";
      adjustPillPosition();
    });
  } else {
    window.addEventListener("resize", () => {
      keyboardHeight = initialViewportHeight - window.innerHeight;
      isKeyboardOpen =
        keyboardHeight > THRESHOLD &&
        document.activeElement?.tagName === "INPUT";
      adjustPillPosition();
    });
  }
}

// Inicialitza alçada i listeners per focus (per estabilitzar)
let initialViewportHeight = window.innerHeight;
window.addEventListener("load", () => {
  initialViewportHeight = window.innerHeight;
});

document.addEventListener("focusin", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
    setTimeout(adjustPillPosition, 300); // Delay per esperar estabilització del teclat
  }
});

document.addEventListener("focusout", () => {
  setTimeout(adjustPillPosition, 100);
});

export { keyboardHeight, isKeyboardOpen };
