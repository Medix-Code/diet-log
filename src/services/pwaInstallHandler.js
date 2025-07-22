/**
 * @file pwaInstallHandler.js
 * @description Gestiona prompt d'instal·lació PWA de manera intel·ligent i respectuosa.
 * @module pwaInstallHandler
 */

// --- Constants de Configuració ---
const LS_KEYS = {
  IS_INSTALLED: "pwa_isInstalled",
  PROMPT_DISMISSED_COUNT: "pwa_promptDismissedCount",
  NEVER_SHOW_AGAIN: "pwa_neverShowAgain",
  ACTION_TRIGGER_COUNT: "pwa_actionTriggerCount",
};

const MAX_DISMISSALS = 2;
const TRIGGER_THRESHOLD = 10;

let deferredInstallPrompt = null;
let installButtonElement = null;
let dismissButtonElement = null;
let installPromptElement = null;
let isInitialized = false;

// --- Funcions de LocalStorage ---
const getLsNumber = (key, defaultValue = 0) =>
  parseInt(localStorage.getItem(key) || String(defaultValue), 10);

const getLsBoolean = (key) => localStorage.getItem(key) === "true";

const setLsValue = (key, value) => localStorage.setItem(key, String(value));

// --- Funcions Públiques i Lògica Principal ---

export function isAppInstalled() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const isLegacyStandalone = window.navigator.standalone === true;
  return (
    isStandalone || isLegacyStandalone || getLsBoolean(LS_KEYS.IS_INSTALLED)
  );
}

function showInstallBanner() {
  // Comprovacions per no mostrar el bàner innecessàriament
  if (
    isAppInstalled() ||
    getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN) ||
    !deferredInstallPrompt ||
    !installPromptElement
  ) {
    return;
  }
  installPromptElement.classList.add("visible");
}

function hideInstallBanner() {
  installPromptElement?.classList.remove("visible");
}

function handleDismissAction() {
  hideInstallBanner();
  let dismissCount = getLsNumber(LS_KEYS.PROMPT_DISMISSED_COUNT);
  dismissCount++;
  setLsValue(LS_KEYS.PROMPT_DISMISSED_COUNT, dismissCount);

  // Si l'usuari l'ha tancat el màxim de vegades, no ho tornem a mostrar mai més
  if (dismissCount >= MAX_DISMISSALS) {
    setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
  }
}

async function handleInstallAction() {
  if (!deferredInstallPrompt) return;

  hideInstallBanner();

  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === "accepted") {
      setLsValue(LS_KEYS.IS_INSTALLED, true);
      setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true); // Si accepta, no ho mostrem més
    }
  } catch (error) {
    // Error silenciós
  } finally {
    deferredInstallPrompt = null;
  }
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  // Només guardem l'event per a un ús posterior. No mostrem res.
  deferredInstallPrompt = event;
}

export function initPwaInstall() {
  if (isInitialized) return;

  installPromptElement = document.getElementById("install-prompt");
  installButtonElement = document.getElementById("install-button");
  dismissButtonElement = document.getElementById("dismiss-button");

  if (installPromptElement && installButtonElement && dismissButtonElement) {
    installButtonElement.addEventListener("click", handleInstallAction);
    dismissButtonElement.addEventListener("click", handleDismissAction);
  }

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

  // Monitoritzem si l'usuari instal·la l'app manualment
  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", (e) => {
      if (e.matches) {
        setLsValue(LS_KEYS.IS_INSTALLED, true);
        setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
      }
    });

  isInitialized = true;
}

/**
 * Funció que es crida després d'una acció important de l'usuari (ex: descarregar PDF).
 * Implementa la lògica de quan mostrar el bàner d'instal·lació.
 */
export function requestInstallPromptAfterAction() {
  // No fem res si ja està instal·lada, si l'usuari ha dit "mai més", o si el navegador no ho permet
  if (
    isAppInstalled() ||
    getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN) ||
    !deferredInstallPrompt
  ) {
    return;
  }

  // Incrementem el comptador d'accions
  let actionCount = getLsNumber(LS_KEYS.ACTION_TRIGGER_COUNT);
  actionCount++;
  setLsValue(LS_KEYS.ACTION_TRIGGER_COUNT, actionCount);

  const dismissCount = getLsNumber(LS_KEYS.PROMPT_DISMISSED_COUNT);

  // Condicions per mostrar el bàner:
  // 1. És la primera descàrrega i mai l'ha tancat.
  // 2. És la desena (o múltiple de 10) descàrrega i només l'ha tancat una vegada.
  const shouldShowNow =
    (actionCount === 1 && dismissCount === 0) ||
    (actionCount >= TRIGGER_THRESHOLD && dismissCount === 1);

  if (shouldShowNow) {
    setTimeout(() => showInstallBanner(), 1500);
    // Opcional: Podem resetejar el comptador d'accions si volem que torni a preguntar a les 20, 30...
    // setLsValue(LS_KEYS.ACTION_TRIGGER_COUNT, 0);
  }
}
