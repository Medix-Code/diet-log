/**
 * @file tabs.js
 * @description Gestió de pestanyes amb swipe.
 * @module tabs
 */

import { updateExternalStylesForCurrentService } from "../services/servicesPanelManager.js";
import { isAnyModalOpen } from "../ui/modals.js";

// --- Constants ---
const TABS = {
  DADES: "dades",
  SERVEIS: "serveis",
};
const LS_SELECTED_TAB_KEY = "selectedTab";
const DOM_IDS = {
  TAB_DADES: `tab-${TABS.DADES}`,
  TAB_SERVEIS: `tab-${TABS.SERVEIS}`,
  CONTENT_DADES: `${TABS.DADES}-tab-content`,
  CONTENT_SERVEIS: `${TABS.SERVEIS}-tab-content`,
  MAIN_CONTENT_AREA: "main-content",
};
const CSS_CLASSES = {
  ACTIVE_TAB: "active",
  ERROR_TAB: "error-tab",
};
const SWIPE_CONFIG = {
  MIN_DISTANCE: 60,
  MAX_VERTICAL_RATIO: 0.5,
};

// --- Variables ---
let currentTab = TABS.DADES;
let touchStartX = 0;
let touchStartY = 0;
let isSwipeEnabled = true;
let swipeTouchStartHandler = null;
let swipeTouchEndHandler = null;
let hasLoadedInitialTab = false;
let isInitialRender = true;

// --- Funcions Públiques ---

/**
 * Obté pestanya actual.
 * @returns {string}
 * @export
 */
export function getCurrentTab() {
  return currentTab;
}

/**
 * Configura tabs.
 * @export
 */
export function setupTabs() {
  const tabDadesElement = document.getElementById(DOM_IDS.TAB_DADES);
  const tabServeisElement = document.getElementById(DOM_IDS.TAB_SERVEIS);

  if (!tabDadesElement || !tabServeisElement) return;

  _hydrateInitialTab();
  tabDadesElement.addEventListener("click", () => switchToTab(TABS.DADES));
  tabServeisElement.addEventListener("click", () => switchToTab(TABS.SERVEIS));

  _setupSwipeListeners();

  switchToTab(currentTab);
}

/**
 * Habilita/desabilita swipe.
 * @param {boolean} enable
 * @export
 */
export function setSwipeEnabled(enable) {
  isSwipeEnabled = !!enable;
}

// --- Funcions Privades ---

function switchToTab(tabName) {
  const shouldSkipGuard = isInitialRender;

  if (
    !shouldSkipGuard &&
    currentTab === tabName &&
    document.scrollingElement.scrollTop !== 0
  ) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  if (!shouldSkipGuard && currentTab === tabName) return;
  if (tabName !== TABS.DADES && tabName !== TABS.SERVEIS) return;

  window.scrollTo({ top: 0, behavior: "auto" });
  currentTab = tabName;
  isInitialRender = false;

  const tabDadesElement = document.getElementById(DOM_IDS.TAB_DADES);
  const tabServeisElement = document.getElementById(DOM_IDS.TAB_SERVEIS);
  const dadesContentElement = document.getElementById(DOM_IDS.CONTENT_DADES);
  const serveisContentElement = document.getElementById(
    DOM_IDS.CONTENT_SERVEIS
  );

  if (
    !tabDadesElement ||
    !tabServeisElement ||
    !dadesContentElement ||
    !serveisContentElement
  )
    return;

  tabDadesElement.classList.remove(CSS_CLASSES.ERROR_TAB);
  tabServeisElement.classList.remove(CSS_CLASSES.ERROR_TAB);

  const isDadesActive = tabName === TABS.DADES;

  tabDadesElement.classList.toggle(CSS_CLASSES.ACTIVE_TAB, isDadesActive);
  tabServeisElement.classList.toggle(CSS_CLASSES.ACTIVE_TAB, !isDadesActive);
  dadesContentElement.classList.toggle(CSS_CLASSES.ACTIVE_TAB, isDadesActive);
  serveisContentElement.classList.toggle(
    CSS_CLASSES.ACTIVE_TAB,
    !isDadesActive
  );

  tabDadesElement.setAttribute(
    "aria-selected",
    isDadesActive ? "true" : "false"
  ); // Accessibilitat
  tabServeisElement.setAttribute(
    "aria-selected",
    !isDadesActive ? "true" : "false"
  );

  if (
    tabName === TABS.SERVEIS &&
    typeof updateExternalStylesForCurrentService === "function"
  ) {
    updateExternalStylesForCurrentService();
  }

  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(LS_SELECTED_TAB_KEY, currentTab);
    } catch {
      // ignore storage errors
    }
  }
}

function _hydrateInitialTab() {
  if (hasLoadedInitialTab) return;
  hasLoadedInitialTab = true;
  if (typeof localStorage === "undefined") return;
  try {
    const stored = localStorage.getItem(LS_SELECTED_TAB_KEY);
    if (stored === TABS.DADES || stored === TABS.SERVEIS) {
      currentTab = stored;
    }
  } catch {
    // ignore storage errors
  }
}

function _setupSwipeListeners() {
  const contentArea = document.getElementById(DOM_IDS.MAIN_CONTENT_AREA);
  if (!contentArea) return;

  swipeTouchStartHandler = _handleTouchStart;
  swipeTouchEndHandler = _handleTouchEnd;

  contentArea.addEventListener("touchstart", swipeTouchStartHandler, {
    passive: true,
  });
  contentArea.addEventListener("touchend", swipeTouchEndHandler, {
    passive: true,
  });
}

export function removeSwipeListeners() {
  const contentArea = document.getElementById(DOM_IDS.MAIN_CONTENT_AREA);
  if (!contentArea || !swipeTouchStartHandler || !swipeTouchEndHandler) return;

  contentArea.removeEventListener("touchstart", swipeTouchStartHandler, {
    passive: true,
  });
  contentArea.removeEventListener("touchend", swipeTouchEndHandler, {
    passive: true,
  });

  // Set to null so that re-add works
  swipeTouchStartHandler = null;
  swipeTouchEndHandler = null;
}

export function addSwipeListeners() {
  const contentArea = document.getElementById(DOM_IDS.MAIN_CONTENT_AREA);
  if (!contentArea) return;

  if (!swipeTouchStartHandler) {
    swipeTouchStartHandler = _handleTouchStart;
    swipeTouchEndHandler = _handleTouchEnd;

    contentArea.addEventListener("touchstart", swipeTouchStartHandler, {
      passive: true,
    });
    contentArea.addEventListener("touchend", swipeTouchEndHandler, {
      passive: true,
    });
  }
}

function _handleTouchStart(event) {
  if (!isSwipeEnabled || isAnyModalOpen()) return;
  const firstTouch = event.touches[0];
  touchStartX = firstTouch.clientX;
  touchStartY = firstTouch.clientY;
}

function _handleTouchEnd(event) {
  if (!isSwipeEnabled || touchStartX === 0) return;
  if (!event.changedTouches || event.changedTouches.length === 0) return;

  const touchEndX = event.changedTouches[0].clientX;
  const touchEndY = event.changedTouches[0].clientY;

  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;

  touchStartX = 0;
  touchStartY = 0;

  if (Math.abs(deltaY) > Math.abs(deltaX) * SWIPE_CONFIG.MAX_VERTICAL_RATIO)
    return;

  if (Math.abs(deltaX) > SWIPE_CONFIG.MIN_DISTANCE) {
    if (deltaX > 0) {
      if (currentTab === TABS.SERVEIS) switchToTab(TABS.DADES);
    } else {
      if (currentTab === TABS.DADES) switchToTab(TABS.SERVEIS);
    }
  }
}
