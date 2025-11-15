/**
 * @file pwaInstallHandler.js
 * @description Gestiona prompt d'instal·lació PWA de manera intel·ligent i respectuosa, amb logs per a depuració.
 * @module pwaInstallHandler
 */

import { logger } from "../utils/logger.js";

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
const log = logger.withScope("PWA");

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

export function showInstallBanner(forceShow = false) {
  log.debug("Intentant mostrar el bàner d'instal·lació...");

  if (isAppInstalled()) {
    log.debug("Bloquejat: L'app ja està instal·lada.");
    return;
  }
  if (getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN)) {
    log.debug("Bloquejat: L'usuari ha demanat no tornar a mostrar.");
    return;
  }
  if (!deferredInstallPrompt) {
    log.debug("Bloquejat: No hi ha cap event d'instal·lació guardat.");
    return;
  }
  if (!installPromptElement) {
    log.debug("Bloquejat: L'element HTML del bàner no s'ha trobat.");
    return;
  }

  log.info("Mostrant el bàner!");
  installPromptElement.classList.add("visible");
  installPromptElement.classList.remove("hidden");
}

function hideInstallBanner() {
  log.debug("Amagant el bàner.");
  installPromptElement?.classList.remove("visible");
  installPromptElement?.classList.add("hidden");
}

function handleDismissAction() {
  log.info("L'usuari ha descartat el bàner.");
  hideInstallBanner();
  let dismissCount = getLsNumber(LS_KEYS.PROMPT_DISMISSED_COUNT);
  dismissCount++;
  setLsValue(LS_KEYS.PROMPT_DISMISSED_COUNT, dismissCount);
  log.debug(`Comptador de descartats actualitzat a: ${dismissCount}`);

  if (dismissCount >= MAX_DISMISSALS) {
    setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
    log.info("S'ha assolit el límit de descartats. No es tornarà a mostrar.");
  }
}

async function handleInstallAction() {
  log.info("L'usuari ha fet clic a 'Instal·lar'.");
  if (!deferredInstallPrompt) {
    log.warn(
      "El botó d'instal·lar s'ha premut, però no hi havia cap event guardat."
    );
    return;
  }

  hideInstallBanner();

  try {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    log.info(`Resultat de la decisió de l'usuari: ${outcome}`);

    if (outcome === "accepted") {
      setLsValue(LS_KEYS.IS_INSTALLED, true);
      setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
      log.info("L'usuari ha acceptat la instal·lació! :)");
    } else {
      log.info(
        "L'usuari ha rebutjat la instal·lació des del diàleg del navegador."
      );
    }
  } catch (error) {
    log.error("Error durant el procés de prompt d'instal·lació:", error);
  } finally {
    deferredInstallPrompt = null;
  }
}

function handleBeforeInstallPrompt(event) {
  event.preventDefault();
  deferredInstallPrompt = event;
  log.debug("Event 'beforeinstallprompt' capturat i guardat.");
}

export function initPwaInstall() {
  if (isInitialized) return;
  log.debug("Inicialitzant el gestor d'instal·lació...");

  installPromptElement = document.getElementById("install-prompt");
  installButtonElement = document.getElementById("install-button");
  dismissButtonElement = document.getElementById("dismiss-button");

  if (installPromptElement && installButtonElement && dismissButtonElement) {
    installButtonElement.addEventListener("click", handleInstallAction);
    dismissButtonElement.addEventListener("click", handleDismissAction);
    log.debug("Botons del bàner d'instal·lació configurats.");
  } else {
    log.warn("No s'han trobat tots els elements del bàner d'instal·lació.");
  }

  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", (e) => {
      if (e.matches) {
        log.info("Detectat canvi a mode 'standalone'. Marcat com instal·lat.");
        setLsValue(LS_KEYS.IS_INSTALLED, true);
        setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
      }
    });

  isInitialized = true;
  log.debug("Gestor d'instal·lació inicialitzat correctament.");
}

export function requestInstallPromptAfterAction() {
  log.debug("------------------------------------------");
  log.debug("Comprovant si s'ha de mostrar el bàner després d'una acció...");

  if (isAppInstalled()) {
    log.debug("[Check] No es mostra: L'app ja està instal·lada.");
    return;
  }
  if (getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN)) {
    log.debug("[Check] No es mostra: L'usuari ha demanat no tornar a veure'l.");
    return;
  }
  if (!deferredInstallPrompt) {
    log.debug(
      "[Check] No es mostra: El navegador no ha ofert la possibilitat d'instal·lar (deferredPrompt és nul)."
    );
    return;
  }

  let actionCount = getLsNumber(LS_KEYS.ACTION_TRIGGER_COUNT);
  actionCount++;
  setLsValue(LS_KEYS.ACTION_TRIGGER_COUNT, actionCount);
  log.debug(`Comptador d'accions incrementat a: ${actionCount}`);

  const dismissCount = getLsNumber(LS_KEYS.PROMPT_DISMISSED_COUNT);
  log.debug(`Vegades que s'ha descartat el bàner: ${dismissCount}`);

  const shouldShowNow =
    (actionCount === 1 && dismissCount === 0) ||
    (actionCount >= TRIGGER_THRESHOLD && dismissCount < MAX_DISMISSALS);

  log.debug(`Es compleixen les condicions per mostrar? ${shouldShowNow}`);

  if (shouldShowNow) {
    setTimeout(() => showInstallBanner(), 1500);
    if (actionCount >= TRIGGER_THRESHOLD) {
      // Opcional: Resetejar el comptador si volem que ho torni a demanar a les 20, 30...
      // setLsValue(LS_KEYS.ACTION_TRIGGER_COUNT, 0);
      // log.debug("Comptador d'accions resetejat (lògica opcional).");
    }
  } else {
    log.debug("No es mostra el bàner aquesta vegada.");
  }
  log.debug("------------------------------------------");
}
