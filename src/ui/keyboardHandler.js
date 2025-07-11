// src/ui/keyboardHandler.js
const savePill = document.getElementById("save-pill");
let keyboardHeight = 0;
let isKeyboardOpen = false;
const MARGIN_ABOVE_KEYBOARD = 10;
const THRESHOLD = 150;

const SPACER_ID = "keyboard-spacer";
const scrollContainer = document.querySelector(".tab-content-container"); // Ajusta si cal (ex.: 'main' o '#main-content')

// Funció per obtenir/crear el spacer dins del container scrollable
function getSpacer() {
  let el = document.getElementById(SPACER_ID);
  if (!el && scrollContainer) {
    el = document.createElement("div");
    el.id = SPACER_ID;
    el.style.width = "100%";
    el.style.height = "0px";
    el.style.pointerEvents = "none";
    el.style.transition = "height 0.3s ease"; // Transició suau per alçada
    el.setAttribute("aria-hidden", "true"); // Accessibilitat
    scrollContainer.appendChild(el); // Afegeix al container scrollable, no a body
  }
  return el;
}

// Funció per ajustar l'alçada del spacer
function setSpacerHeight(h = 0) {
  const spacer = getSpacer();
  if (spacer) {
    spacer.style.height = `${h}px`;
  }
}

// Funció per ajustar posició: fixa arran del teclat, ignorant scroll
function adjustPillPosition(height = keyboardHeight) {
  // Espai extra perquè el formulari pugui desplaçar-se
  setSpacerHeight(isKeyboardOpen ? height : 0);

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

export { keyboardHeight };
