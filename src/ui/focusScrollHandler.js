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

  const absoluteTop = window.scrollY + rect.top;
  const absoluteBottom = absoluteTop + rect.height;

  // Calcula l'alçada de les barres fixes (topbar + tabs)
  const fixedHeadersHeight = getFixedHeadersHeight();

  // El camp ha d'estar just per sota de les barres fixes + el marge extra
  const targetPositionFromTop = fixedHeadersHeight + EXTRA_TOP_MARGIN;

  // Calculem on ha d'estar el scroll perquè el camp quedi a la posició desitjada
  const maxScroll = Math.max(scrollingElement.scrollHeight - viewportHeight, 0);
  let targetScroll = clamp(absoluteTop - targetPositionFromTop, 0, maxScroll);

  // Ara assegurem que hi ha espai suficient per sota per al dropdown
  const elementBottomAfterScroll = absoluteBottom - targetScroll;
  const spaceBelow = viewportHeight - elementBottomAfterScroll;

  const maxSpaceBelow = Math.max(
    viewportHeight - (targetPositionFromTop + rect.height),
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
