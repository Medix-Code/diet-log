// src/ui/focusScrollHandler.js
import { keyboardHeight } from "./keyboardHandler.js"; // Importa l'alçada del teclat

// Selecciona tots els inputs i selects del formulari (ajusta selectors si cal)
const formElements = document.querySelectorAll("input, select, textarea");

// Offset base per deixar espai per sobre del teclat (ajusta segons proves)
const BASE_SCROLL_OFFSET = 120; // Pixels per sobre de l'input per visibilitat
const LABEL_MARGIN = 20; // Marge extra entre label i input

/**
 * Desplaça el contenidor fins que l’element quedi visible.
 * La primera passada (anticipada=true) ignora l’alçada del teclat.
 */
function scrollToFocusedElement(element, anticipada = false) {
  if (!element) return;

  // Alçada del <label> (si existeix)
  const label = element.closest(".form-group")?.querySelector("label");
  const labelTall = label
    ? label.getBoundingClientRect().height + LABEL_MARGIN
    : 0;

  // Offset total: base + label + (teclat si no és passada anticipada)
  const offset =
    BASE_SCROLL_OFFSET + labelTall + (anticipada ? 0 : keyboardHeight);

  // Destí de l’scroll
  const rect = element.getBoundingClientRect();
  const targetY = rect.top + window.scrollY - offset;

  window.scrollTo({ top: targetY, behavior: "smooth" });
}

// Afegeix listener de focus a tots els elements editables
formElements.forEach((el) =>
  el.addEventListener("focus", () => handleFocus(el))
);

document.addEventListener("focusin", (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {
    // petita espera per assegurar que visualViewport ja s'ha actualitzat
    requestAnimationFrame(() => scrollToFocusedElement(e.target));
  }
});

/**
 * Gestor de focus en dues passades:
 *   1) immediata (sense alçada de teclat) ― evita que l’input quedi tapat;
 *   2) definitiva un frame més tard ― ja coneixem keyboardHeight.
 */
function handleFocus(element) {
  scrollToFocusedElement(element, /*anticipada=*/ true);

  // Un sol frame (~16 ms) perquè visualViewport/geometrychange s’hagi actualitzat
  requestAnimationFrame(() => scrollToFocusedElement(element));
}
