// src/ui/focusScrollHandler.js

// Selecciona tots els inputs i selects del formulari (ajusta selectors si cal)
const formElements = document.querySelectorAll("input, select, textarea");

// Offset base per deixar espai per sobre del teclat (ajusta segons proves: 100-200px)
const BASE_SCROLL_OFFSET = 120; // Pixels per sobre de l'input per visibilitat
const LABEL_MARGIN = 20; // Marge extra entre label i input (per no tapar)

// Funció per scroll suau a l'element focusat, incloent alçada del label
function scrollToFocusedElement(element) {
  if (!element) return;

  // Troba el label associat: assumeix que està dins del mateix .form-group o com a sibling
  const parentGroup = element.closest(".form-group"); // Selector del teu HTML
  const label = parentGroup ? parentGroup.querySelector("label") : null;

  let labelHeight = 0;
  if (label) {
    const labelRect = label.getBoundingClientRect();
    labelHeight = labelRect.height + LABEL_MARGIN; // Suma alçada del label + marge
  }

  // Calcula la posició relativa al viewport, incloent label
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const targetY = rect.top + scrollTop - (BASE_SCROLL_OFFSET + labelHeight);

  // Scroll suau amb behavior 'smooth' per UX millor
  window.scrollTo({
    top: targetY,
    behavior: "smooth",
  });
}

// Afegeix listener de focus a tots els elements editables
formElements.forEach((el) => {
  el.addEventListener("focus", () => {
    // Delay per esperar que el teclat s'obri i el viewport s'ajusti
    setTimeout(() => scrollToFocusedElement(el), 100);
  });
});

// Opcional: Escolta el click a la fletxa "següent" via keydown, però no cal ja que focus ho cobreix
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === "Tab") {
    // Tab per teclat físic, Enter per virtual
    const focused = document.activeElement;
    if (focused && focused.tagName === "INPUT") {
      setTimeout(() => scrollToFocusedElement(document.activeElement), 100);
    }
  }
});
