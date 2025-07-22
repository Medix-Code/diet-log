/**
 * @file pwaInstallHandler.js
 * @description Gestiona prompt d'instal·lació PWA de manera intel·ligent i respectuosa, amb logs per a depuració.
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
  console.log("[PWA] Intentant mostrar el bàner d'instal·lació...");

  if (isAppInstalled()) {
    console.log("[PWA] Bloquejat: L'app ja està instal·lada.");
    return;
  }
  if (getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN)) {
    console.log("[PWA] Bloquejat: L'usuari ha demanat no tornar a mostrar.");
    return;
  }
  if (!deferredInstallPrompt) {
    console.log("[PWA] Bloquejat: No hi ha cap event d'instal·lació guardat.");
    return;
  }
  if (!installPromptElement) {
    console.log("[PWA] Bloquejat: L'element HTML del bàner no s'ha trobat.");
    return;
  }

  console.log("%c[PWA] Mostrant el bàner!", "color: green; font-weight: bold;");
  installPromptElement.classList.add("visible");
}

function hideInstallBanner() {
  console.log("[PWA] Amagant el bàner.");
  installPromptElement?.classList.remove("visible");
}

function handleDismissAction() {
  console.log("[PWA] L'usuari ha descartat el bàner.");
  hideInstallBanner();
  let dismissCount = getLsNumber(LS_KEYS.PROMPT_DISMISSED_COUNT);
  dismissCount++;
  setLsValue(LS_KEYS.PROMPT_DISMISSED_COUNT, dismissCount);
  console.log(`[PWA] Comptador de descartats actualitzat a: ${dismissCount}`);

  if (dismissCount >= MAX_DISMISSALS) {
    setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
    console.log(
      "%c[PWA] S'ha assolit el límit de descartats. No es tornarà a mostrar.",
      "color: orange;"
    );
  }
}

async function handleInstallAction() {
  console.log("[PWA] L'usuari ha fet clic a 'Instal·lar'.");
  if (!deferredInstallPrompt) {
    console.warn(
      "[PWA] El botó d'instal·lar s'ha premut, però no hi havia cap event guardat."
    );
    return;
  }

  hideInstallBanner();

  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`[PWA] Resultat de la decisió de l'usuari: ${outcome}`);

    if (outcome === "accepted") {
      setLsValue(LS_KEYS.IS_INSTALLED, true);
      setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
      console.log(
        "%c[PWA] L'usuari ha acceptat la instal·lació! :)",
        "color: green; font-weight: bold;"
      );
    } else {
      console.log(
        "[PWA] L'usuari ha rebutjat la instal·lació des del diàleg del navegador."
      );
    }
  } catch (error) {
    console.error(
      "[PWA] Error durant el procés de prompt d'instal·lació:",
      error
    );
  } finally {
    deferredInstallPrompt = null;
  }
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  console.log(
    "%c[PWA] Event 'beforeinstallprompt' capturat i guardat.",
    "color: blue;"
  );
}

export function initPwaInstall() {
  if (isInitialized) return;
  console.log("[PWA] Inicialitzant el gestor d'instal·lació...");

  installPromptElement = document.getElementById("install-prompt");
  installButtonElement = document.getElementById("install-button");
  dismissButtonElement = document.getElementById("dismiss-button");

  if (installPromptElement && installButtonElement && dismissButtonElement) {
    installButtonElement.addEventListener("click", handleInstallAction);
    dismissButtonElement.addEventListener("click", handleDismissAction);
    console.log("[PWA] Botons del bàner d'instal·lació configurats.");
  } else {
    console.warn(
      "[PWA] No s'han trobat tots els elements del bàner d'instal·lació."
    );
  }

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", (e) => {
      if (e.matches) {
        console.log(
          "[PWA] Detectat canvi a mode 'standalone'. Marcat com instal·lat."
        );
        setLsValue(LS_KEYS.IS_INSTALLED, true);
        setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
      }
    });

  isInitialized = true;
  console.log("[PWA] Gestor d'instal·lació inicialitzat correctament.");
}

export function requestInstallPromptAfterAction() {
  console.log("------------------------------------------");
  console.log(
    "[PWA] Comprovant si s'ha de mostrar el bàner després d'una acció..."
  );

  if (isAppInstalled()) {
    console.log("[PWA Check] No es mostra: L'app ja està instal·lada.");
    return;
  }
  if (getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN)) {
    console.log(
      "[PWA Check] No es mostra: L'usuari ha demanat no tornar a veure'l."
    );
    return;
  }
  if (!deferredInstallPrompt) {
    console.log(
      "[PWA Check] No es mostra: El navegador no ha ofert la possibilitat d'instal·lar (deferredPrompt és nul)."
    );
    return;
  }

  let actionCount = getLsNumber(LS_KEYS.ACTION_TRIGGER_COUNT);
  actionCount++;
  setLsValue(LS_KEYS.ACTION_TRIGGER_COUNT, actionCount);
  console.log(`[PWA] Comptador d'accions incrementat a: ${actionCount}`);

  const dismissCount = getLsNumber(LS_KEYS.PROMPT_DISMISSED_COUNT);
  console.log(`[PWA] Vegades que s'ha descartat el bàner: ${dismissCount}`);

  const shouldShowNow =
    (actionCount === 1 && dismissCount === 0) ||
    (actionCount >= TRIGGER_THRESHOLD && dismissCount < MAX_DISMISSALS);

  console.log(
    `[PWA] Es compleixen les condicions per mostrar? ${shouldShowNow}`
  );

  if (shouldShowNow) {
    setTimeout(() => showInstallBanner(), 1500);
    if (actionCount >= TRIGGER_THRESHOLD) {
      // Opcional: Resetejar el comptador si volem que ho torni a demanar a les 20, 30...
      // setLsValue(LS_KEYS.ACTION_TRIGGER_COUNT, 0);
      // console.log("[PWA] Comptador d'accions resetejat (lògica opcional).");
    }
  } else {
    console.log("[PWA] No es mostra el bàner aquesta vegada.");
  }
  console.log("------------------------------------------");
}
