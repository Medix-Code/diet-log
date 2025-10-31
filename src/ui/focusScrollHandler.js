// src/ui/focusScrollHandler.js

const FOCUS_SCROLL_DELAY = 250;
const EXTRA_TOP_MARGIN = 16; // Espai extra per sobre del camp
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
  const topBar = document.querySelector(".top-bar");
  const tabsContainer = document.querySelector(".tabs-container");

  let totalHeight = 0;

  if (topBar) {
    totalHeight += topBar.offsetHeight;
  }

  if (tabsContainer) {
    totalHeight += tabsContainer.offsetHeight;
  }

  return totalHeight;
};

const ensureSpaceForLocationDropdown = (element) => {
  const { height: viewportHeight } = getViewportMetrics();
  const rect = element.getBoundingClientRect();
  const scrollingElement =
    document.scrollingElement || document.documentElement || document.body;

  // Posició absoluta de l'element respecte el document
  const absoluteTop = window.scrollY + rect.top;

  // Calcula l'alçada de les barres fixes (topbar + tabs)
  const fixedHeadersHeight = getFixedHeadersHeight();

  // IMPORTANT: Les barres fixes NO es mouen amb el scroll
  // El camp ha d'aparèixer VISUALMENT per sota de les barres + marge
  // Això significa que la seva posició en pantalla (rect.top) ha de ser >= fixedHeadersHeight + marge
  const desiredVisualTop = fixedHeadersHeight + EXTRA_TOP_MARGIN;

  // Per aconseguir que rect.top sigui igual a desiredVisualTop,
  // necessitem fer scroll fins: absoluteTop - desiredVisualTop
  const maxScroll = Math.max(scrollingElement.scrollHeight - viewportHeight, 0);
  let targetScroll = clamp(absoluteTop - desiredVisualTop, 0, maxScroll);

  // Ara assegurem que hi ha espai suficient per sota per al dropdown
  // Després del scroll, l'element estarà a desiredVisualTop píxels des de dalt
  const elementVisualBottom = desiredVisualTop + rect.height;
  const spaceBelow = viewportHeight - elementVisualBottom;

  const maxSpaceBelow = Math.max(
    viewportHeight - (desiredVisualTop + rect.height),
    0
  );
  const desiredSpaceBelow = Math.min(
    MIN_SPACE_BELOW_FOR_LOCATIONS,
    maxSpaceBelow
  );

  if (spaceBelow < desiredSpaceBelow) {
    const extraScroll = Math.min(
      desiredSpaceBelow - spaceBelow,
      Math.max(maxScroll - targetScroll, 0)
    );

    if (extraScroll > 0) {
      targetScroll += extraScroll;
    }
  }

  window.scrollTo({
    top: targetScroll,
    behavior: "smooth",
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
