/**
 * @file pwaInstallHandler.js
 * @description Gestiona prompt d'instal·lació PWA.
 * @module pwaInstallHandler
 */

const LS_KEYS = {
  IS_INSTALLED: "pwa_isInstalled",
  TIMES_DISMISSED: "pwa_timesDismissed",
  NEVER_SHOW_AGAIN: "pwa_neverShowInstallPrompt",
};

const CSS_CLASSES = {
  INSTALL_PROMPT_VISIBLE: "visible",
};

const MAX_DISMISSALS = 2;

let deferredInstallPrompt = null;
let installButtonElement = null;
let dismissButtonElement = null;
let installPromptElement = null;
let isInitialized = false;

const getLsNumber = (key, defaultValue = 0) =>
  parseInt(localStorage.getItem(key) || String(defaultValue), 10);

const getLsBoolean = (key) => localStorage.getItem(key) === "true";

const setLsValue = (key, value) => localStorage.setItem(key, String(value));

export function isAppInstalled() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isLegacyStandalone = window.navigator.standalone === true;
  const isMarkedInstalled = getLsBoolean(LS_KEYS.IS_INSTALLED);
  return isStandalone || isLegacyStandalone || isMarkedInstalled;
}

function hideInstallBanner() {
  installPromptElement?.classList.remove(CSS_CLASSES.INSTALL_PROMPT_VISIBLE);
}

export function showInstallBanner(forceShow = false) {
  if (
    isAppInstalled() ||
    (!forceShow && getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN)) ||
    !deferredInstallPrompt ||
    !installPromptElement
  )
    return;

  installPromptElement.classList.add(CSS_CLASSES.INSTALL_PROMPT_VISIBLE);
}

function handleDismissAction() {
  hideInstallBanner();
  let dismissCount = getLsNumber(LS_KEYS.TIMES_DISMISSED);
  dismissCount++;
  setLsValue(LS_KEYS.TIMES_DISMISSED, dismissCount);

  if (dismissCount >= MAX_DISMISSALS)
    setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
}

async function handleInstallAction() {
  if (!deferredInstallPrompt) return;

  hideInstallBanner();

  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") setLsValue(LS_KEYS.IS_INSTALLED, true);
  } catch (error) {
    // Maneig silenciós
  } finally {
    deferredInstallPrompt = null;
  }
}

function linkInstallControls() {
  installButtonElement?.addEventListener("click", handleInstallAction);
  dismissButtonElement?.addEventListener("click", handleDismissAction);
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  showInstallBanner();
}

function monitorDisplayModeChanges() {
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", (evt) => {
    if (evt.matches) setLsValue(LS_KEYS.IS_INSTALLED, true);
  });
}

export function initPwaInstall() {
  if (isInitialized) return;

  if (isAppInstalled()) {
    monitorDisplayModeChanges();
    isInitialized = true;
    return;
  }

  if (getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN)) {
    monitorDisplayModeChanges();
    isInitialized = true;
    return;
  }

  installPromptElement = document.getElementById("install-prompt");
  installButtonElement = document.getElementById("install-button");
  dismissButtonElement = document.getElementById("dismiss-button");

  if (installPromptElement && installButtonElement && dismissButtonElement)
    linkInstallControls();

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

  monitorDisplayModeChanges();

  isInitialized = true;
}

export function requestInstallPromptAfterAction() {
  if (
    isAppInstalled() ||
    getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN) ||
    !deferredInstallPrompt
  )
    return;

  const dismissCount = getLsNumber(LS_KEYS.TIMES_DISMISSED);

  if (dismissCount === 0) {
    setTimeout(() => showInstallBanner(), 3000);
  }
}
