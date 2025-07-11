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

  // Dins de scrollToFocusedElement, afegeix això abans del scrollTo
  const dynamicOffset =
    BASE_SCROLL_OFFSET + labelHeight + (keyboardHeight || 0) + 50; // +50px extra per camps inferiors com Ayudante

  // Calcula la posició relativa al viewport
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const targetY = rect.top + scrollTop - dynamicOffset;

  // Scroll suau
  window.scrollTo({
    top: targetY,
    behavior: "smooth",
  });

  // Fallback amb scrollIntoView: Canvia block a 'nearest' per posicionar al més proper visible
  setTimeout(() => {
    if (keyboardHeight > 0) {
      element.scrollIntoView({ block: "nearest", behavior: "smooth" }); // 'nearest' evita centrar si ja és visible, millor per inferiors
    }
  }, 200);
}

// Afegeix listener de focus a tots els elements editables
formElements.forEach((el) => {
  el.addEventListener("focus", () => {
    setTimeout(() => scrollToFocusedElement(el), 100);
  });
});

// Opcional: Escolta keydown per fletxa "següent"
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "Tab") {
    const focused = document.activeElement;
    if (focused && focused.tagName === "INPUT") {
      setTimeout(() => scrollToFocusedElement(document.activeElement), 100);
    }
  }
});
