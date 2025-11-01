// src/ui/focusScrollHandler.js

const FOCUS_SCROLL_DELAY = 250;
const EXTRA_TOP_MARGIN = 30; // Espai extra per sobre del camp
const MIN_SPACE_BELOW_FOR_LOCATIONS = 320;

const formElements = document.querySelectorAll(
  'input:not([type="checkbox"]), select, textarea'
);

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getViewportMetrics = () => {
  const viewport = window.visualViewport;
  return {
    height: viewport?.height ?? window.innerHeight,
    top: viewport?.offsetTop ?? 0,
  };
};

/**
 * Calcula l'alçada total de les barres fixes superiors (topbar + tabs)
 * per assegurar que el contingut no queda tapat
 */
const getFixedHeadersHeight = () => {
  const selectors = [".top-bar", ".tabs-container"];
  let maxBottom = 0;

  selectors.forEach((selector) => {
    const element = document.querySelector(selector);
    if (!element) return;

    const rect = element.getBoundingClientRect();
    if (rect.bottom > maxBottom) {
      maxBottom = rect.bottom;
    }
  });

  return Math.max(maxBottom, 0);
};

/**
 * Actualitza la variable CSS --fixed-headers-height amb l'alçada real
 * de les capçaleres fixes (topbar + tabs)
 */
const updateFixedHeadersHeight = () => {
  const height = getFixedHeadersHeight();
  document.documentElement.style.setProperty(
    "--fixed-headers-height",
    `${height}px`
  );
};

// Actualitzar al carregar i quan es redimensiona la finestra
updateFixedHeadersHeight();
window.addEventListener("resize", updateFixedHeadersHeight);
window.addEventListener("orientationchange", updateFixedHeadersHeight);

const ensureSpaceForLocationDropdown = (element) => {
  // Utilitzem scrollIntoView que respecta el scroll-margin-top del CSS
  // Això assegura que l'element no quedi amagat darrere de la topbar i els tabs
  element.scrollIntoView({
    behavior: "smooth",
    block: "start", // Alinea al principi del viewport (respectant scroll-margin-top)
    inline: "nearest",
  });
};

function handleFocus(event) {
  const element = event.target;

  if (!(element instanceof HTMLElement)) {
    return;
  }

  if (element.closest(".modal")) {
    return;
  }

  setTimeout(() => {
    if (!document.body.contains(element)) {
      return;
    }

    const isLocationField =
      element.classList.contains("origin") ||
      element.classList.contains("destination");

    if (isLocationField) {
      ensureSpaceForLocationDropdown(element);
      return;
    }

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, FOCUS_SCROLL_DELAY);
}

formElements.forEach((el) => {
  el.addEventListener("focus", handleFocus);
});
