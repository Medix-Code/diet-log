// src/ui/focusScrollHandler.js

import { keyboardHeight, isKeyboardOpen } from "./keyboardHandler.js";

// Selecciona tots els inputs i selects del formulari
const formElements = document.querySelectorAll("input, select, textarea");

// Offset base per deixar espai per sobre del teclat
const BASE_SCROLL_OFFSET = 120;
const LABEL_MARGIN = 20;

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
    setTimeout(() => {
      if (keyboardHeight > 0) {
        requestAnimationFrame(() => {
          element.scrollIntoView({ block: "center", behavior: "smooth" });
        });
      }
    }, 100);
  }
}

// A src/ui/focusScrollHandler.js

function handleFocus(el) {
  // Ignorem els modals com ja feies
  if (el.closest(".modal")) {
    return;
  }

  // Esperem un petit instant perquè el teclat comenci a aparèixer
  setTimeout(() => {
    // La funció 'scrollIntoView' és la manera estàndard de fer això.
    // 'block: "nearest"' intentarà moure l'element el mínim possible per fer-lo visible.
    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });

    // Afegeix un scroll extra si l'element queda massa enganxat a dalt.
    // Aquesta part és opcional, per a un refinament extra.
    setTimeout(() => {
      if (window.scrollY < 50) {
        // Si l'scroll és molt a dalt
        window.scrollBy({ top: -80, behavior: "smooth" }); // Tira una mica avall
      }
    }, 150);
  }, 100); // Un petit delay és crucial
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
