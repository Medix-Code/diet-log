// src/ui/focusScrollHandler.js
import { keyboardHeight } from "./keyboardHandler.js"; // Importa l'alçada del teclat

// Selecciona tots els inputs i selects del formulari (ajusta selectors si cal)
const formElements = document.querySelectorAll("input, select, textarea");

// Offset base per deixar espai per sobre del teclat (ajusta segons proves)
const BASE_SCROLL_OFFSET = 120; // Pixels per sobre de l'input per visibilitat
const LABEL_MARGIN = 20; // Marge extra entre label i input

// Funció per scroll suau a l'element focusat, incloent alçada del label i teclat
function scrollToFocusedElement(element) {
  if (!element) return;

  // Troba el label associat
  const parentGroup = element.closest(".form-group");
  const label = parentGroup ? parentGroup.querySelector("label") : null;

  let labelHeight = 0;
  if (label) {
    const labelRect = label.getBoundingClientRect();
    labelHeight = labelRect.height + LABEL_MARGIN;
  }

  // Inclou l'alçada del teclat per camps inferiors (dinàmic)
  const dynamicOffset =
    BASE_SCROLL_OFFSET + labelHeight + (keyboardHeight || 0);

  // Calcula la posició relativa al viewport
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const targetY = rect.top + scrollTop - dynamicOffset;

  // Scroll suau amb behavior 'smooth' i delay augmentat per sincronitzar amb teclat
  setTimeout(() => {
    window.scrollTo({
      top: targetY,
      behavior: "smooth", // Ja suau, però amb delay més gran per fluiditat
    });
  }, 200); // Augmentat a 200ms per esperar millor l'estabilització

  // Fallback: Si el teclat tapa encara, usa scrollIntoView per centrar amb smooth
  setTimeout(() => {
    if (keyboardHeight > 0) {
      // Només si teclat obert
      element.scrollIntoView({ block: "center", behavior: "smooth" }); // Centra l'input al viewport amb suavitat
    }
  }, 300); // Delay addicional augmentat per estabilitzar i fer-ho més suau
}

// Afegeix listener de focus a tots els elements editables
formElements.forEach((el) => {
  el.addEventListener("focus", () => {
    setTimeout(() => scrollToFocusedElement(el), 200); // Delay inicial augmentat per més suavitat
  });
});

// Opcional: Escolta keydown per fletxa "següent"
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "Tab") {
    const focused = document.activeElement;
    if (focused && focused.tagName === "INPUT") {
      setTimeout(() => scrollToFocusedElement(document.activeElement), 200);
    }
  }
});
