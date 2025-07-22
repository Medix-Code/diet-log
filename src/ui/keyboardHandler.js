// src/ui/keyboardHandler.js

const savePill = document.getElementById("save-pill");
const scrollContainer = document.querySelector(".tab-content-container");

let keyboardHeight = 0;
let isKeyboardOpen = false;

const MARGIN_ABOVE_KEYBOARD = 10;
const THRESHOLD = 150;

// Guardem el padding per defecte que ve del CSS (60px)
const DEFAULT_PADDING_BOTTOM = scrollContainer
  ? parseInt(window.getComputedStyle(scrollContainer).paddingBottom, 10) || 60
  : 60;

function adjustUIForKeyboard(height = keyboardHeight) {
  isKeyboardOpen = height > THRESHOLD;

  if (isKeyboardOpen) {
    // Teclat obert: Mou la píndola i afegeix padding
    savePill.style.bottom = `calc(${height}px + ${MARGIN_ABOVE_KEYBOARD}px + env(safe-area-inset-bottom, 0px))`;
    if (scrollContainer) {
      scrollContainer.style.paddingBottom = `${height + 50}px`;
    }
  } else {
    // Teclat tancat: Restaura la píndola i el padding per defecte
    savePill.style.bottom = `calc(20px + env(safe-area-inset-bottom, 0px))`;
    if (scrollContainer) {
      scrollContainer.style.paddingBottom = `${DEFAULT_PADDING_BOTTOM}px`;
    }
  }
}

// API principal per detectar el teclat
if ("virtualKeyboard" in navigator) {
  navigator.virtualKeyboard.overlaysContent = true;
  navigator.virtualKeyboard.addEventListener("geometrychange", (event) => {
    keyboardHeight = event.target.boundingRect.height;
    adjustUIForKeyboard(keyboardHeight);
  });
} else {
  // Fallback per a navegadors antics
  let initialHeight = window.innerHeight;
  window.addEventListener("resize", () => {
    // Aquesta heurística és menys fiable, però és el millor que podem fer
    if (window.innerHeight < initialHeight) {
      keyboardHeight = initialHeight - window.innerHeight;
      adjustUIForKeyboard(keyboardHeight);
    } else {
      keyboardHeight = 0;
      adjustUIForKeyboard(0);
    }
  });
}

export { keyboardHeight, isKeyboardOpen };
