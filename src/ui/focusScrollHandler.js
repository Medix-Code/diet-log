// src/ui/focusScrollHandler.js

// Selecciona tots els inputs i selects del formulari (ajusta selectors si cal)
const formElements = document.querySelectorAll("input, select, textarea");

// Offset per deixar espai per sobre del teclat (ajusta segons proves: 100-200px)
const SCROLL_OFFSET = 120; // Pixels per sobre de l'input per visibilitat

// Funció per scroll suau a l'element focusat
function scrollToFocusedElement(element) {
  if (!element) return;

  // Calcula la posició relativa al viewport
  const rect = element.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const targetY = rect.top + scrollTop - SCROLL_OFFSET;

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
