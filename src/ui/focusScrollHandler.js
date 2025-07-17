// src/ui/focusScrollHandler.js
import { keyboardHeight, isKeyboardOpen } from "./keyboardHandler.js"; // Importa també isKeyboardOpen per optimitzacions

// Selecciona tots els inputs i selects del formulari (ajusta selectors si cal)
const formElements = document.querySelectorAll("input, select, textarea");

// Offset base per deixar espai per sobre del teclat (ajusta segons proves)
const BASE_SCROLL_OFFSET = 120; // Pixels per sobre de l'input per visibilitat
const LABEL_MARGIN = 20; // Marge extra entre label i input

// Funció per scroll suau a l'element focusat, incloent alçada del label i teclat
function scrollToFocusedElement(element, anticipat = false) {
  if (!element) return;

  // Troba el label associat
  const parentGroup = element.closest(".form-group");
  const label = parentGroup ? parentGroup.querySelector("label") : null;

  let labelHeight = 0;
  if (label) {
    const labelRect = label.getBoundingClientRect();
    labelHeight = labelRect.height + LABEL_MARGIN;
  }

  // Inclou l'alçada del teclat només si no és passada anticipada o teclat ja obert
  const teclatOffset = anticipat && !isKeyboardOpen ? 0 : keyboardHeight || 0;

  // Calcula la posició relativa al viewport
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const targetY =
    rect.top + scrollTop - (BASE_SCROLL_OFFSET + labelHeight + teclatOffset);

  // Scroll suau amb requestAnimationFrame per més fluiditat
  requestAnimationFrame(() => {
    window.scrollTo({
      top: targetY,
      behavior: "smooth",
    });
  });

  // Fallback: Si el teclat tapa encara, usa scrollIntoView per centrar
  if (!anticipat) {
    // Només en la segona passada
    setTimeout(() => {
      if (keyboardHeight > 0) {
        requestAnimationFrame(() => {
          element.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      }
    }, 100); // Delay ajustat per segona passada
  }
}

// Funció per manejar focus amb dues passades (la teva proposta refinada)
function handleFocus(el) {
  scrollToFocusedElement(el, true);
  setTimeout(() => scrollToFocusedElement(el), 50);
}

formElements.forEach((el) => {
  el.addEventListener("focus", () => handleFocus(el));
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "Tab") {
    const focused = document.activeElement;
    if (focused && focused.tagName === "INPUT") {
      handleFocus(document.activeElement);
    }
  }
});
