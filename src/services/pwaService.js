/**
 * @file pwaInstallHandler.js
 * @description Gestiona la lògica per al prompt d'instal·lació de la PWA,
 * incloent la captura de l'esdeveniment, la interacció de l'usuari i
 * la persistència de l'estat.
 * @module pwaInstallHandler
 */

// --- Constants ---
const LS_KEYS = {
  IS_INSTALLED: "pwa_isInstalled",
  TIMES_DISMISSED: "pwa_timesDismissed",
  NEVER_SHOW_AGAIN: "pwa_neverShowInstallPrompt",
  // PDF_DOWNLOADS_SINCE_DISMISS: 'pwa_pdfDownloadsSinceNo', // Sembla no utilitzat aquí, però el mantenim si és rellevant en un altre lloc
};
const CSS_CLASSES = {
  INSTALL_PROMPT_VISIBLE: "visible", // Classe per mostrar el banner
};
const MAX_DISMISSALS = 2; // Nombre màxim de vegades que l'usuari pot descartar abans d'amagar permanentment

// --- Variables d'Estat del Mòdul ---
let deferredInstallPrompt = null; // Emmagatzema l'esdeveniment 'beforeinstallprompt'
let installButtonElement = null;
let dismissButtonElement = null;
let installPromptElement = null;
let isInitialized = false;

// --- Funcions Auxiliars per a localStorage ---

/** Obté un valor numèric de localStorage. */
const getLsNumber = (key, defaultValue = 0) =>
  parseInt(localStorage.getItem(key) || String(defaultValue), 10);

/** Obté un valor booleà de localStorage. */
const getLsBoolean = (key) => localStorage.getItem(key) === "true";

/** Estableix un valor a localStorage (converteix a string). */
const setLsValue = (key, value) => localStorage.setItem(key, String(value));

/** Elimina un valor de localStorage. */
const removeLsValue = (key) => localStorage.removeItem(key);

// --- Funcions Principals ---

/**
 * Comprova si l'aplicació s'està executant en mode standalone o ja està marcada com instal·lada.
 * @returns {boolean} True si l'app es considera instal·lada.
 */
export function isAppInstalled() {
  // Prioritza Media Query, és l'estàndard modern
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  // navigator.standalone és per a iOS Safari més antic
  const isLegacyStandalone = window.navigator.standalone === true;
  // Comprovació final amb localStorage (si l'usuari va acceptar el prompt)
  const isMarkedInstalled = getLsBoolean(LS_KEYS.IS_INSTALLED);

  return isStandalone || isLegacyStandalone || isMarkedInstalled;
}

/**
 * Amaga el banner d'instal·lació personalitzat.
 */
function hideInstallBanner() {
  if (installPromptElement) {
    installPromptElement.classList.remove(CSS_CLASSES.INSTALL_PROMPT_VISIBLE);
    // console.info('[PWA Install] Banner d\'instal·lació amagat.');
  }
}

/**
 * Mostra el banner d'instal·lació personalitzat si és pertinent.
 * Es pot cridar manualment o automàticament després de capturar `beforeinstallprompt`.
 * @param {boolean} [forceShow=false] - Si és true, ignora la comprovació 'neverShowAgain'. Útil per a proves.
 */
export function showInstallBanner(forceShow = false) {
  // No mostra si: ja està instal·lada, l'usuari ha demanat no mostrar-ho més (tret que es forci),
  // o si no tenim un prompt per oferir, o l'element del banner no existeix.
  if (
    isAppInstalled() ||
    (!forceShow && getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN)) ||
    !deferredInstallPrompt ||
    !installPromptElement
  ) {
    // console.info('[PWA Install] No es mostra el banner (ja instal·lada, bloquejada, sense prompt o element).');
    return;
  }

  installPromptElement.classList.add(CSS_CLASSES.INSTALL_PROMPT_VISIBLE);
  console.info("[PWA Install] Banner d'instal·lació mostrat.");
}

/**
 * Gestiona l'acció de l'usuari de descartar el prompt d'instal·lació.
 * Incrementa el comptador de descarts i decideix si cal deixar de mostrar el prompt.
 */
function handleDismissAction() {
  hideInstallBanner(); // Amaga immediatament
  let dismissCount = getLsNumber(LS_KEYS.TIMES_DISMISSED);
  dismissCount++;
  setLsValue(LS_KEYS.TIMES_DISMISSED, dismissCount);
  console.log(
    `[PWA Install] Banner descartat per l'usuari (vegada ${dismissCount}).`
  );

  // Opcional: Reiniciar comptador de descàrregues si és rellevant
  // setLsValue(LS_KEYS.PDF_DOWNLOADS_SINCE_DISMISS, 0);

  if (dismissCount >= MAX_DISMISSALS) {
    setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
    console.warn(
      `[PWA Install] L'usuari ha descartat la instal·lació ${dismissCount} vegades. No es tornarà a oferir automàticament.`
    );
  }
}

/**
 * Gestiona el clic al botó d'instal·lació personalitzat.
 * Mostra el diàleg natiu del navegador.
 */
async function handleInstallAction() {
  if (!deferredInstallPrompt) {
    console.error(
      "[PWA Install] S'ha intentat instal·lar, però deferredInstallPrompt és nul."
    );
    return;
  }

  // Amaga el nostre banner abans de mostrar el prompt natiu
  hideInstallBanner();

  try {
    console.info("[PWA Install] Mostrant el diàleg d'instal·lació natiu...");
    deferredInstallPrompt.prompt(); // Mostra el prompt del navegador

    // Espera la decisió de l'usuari
    const { outcome } = await deferredInstallPrompt.userChoice;

    if (outcome === "accepted") {
      console.log("[PWA Install] ✅ Usuari ha ACCEPTAT la instal·lació.");
      setLsValue(LS_KEYS.IS_INSTALLED, true);
      // Opcionalment, podem amagar permanentment el botó/prompt si volem
      // setLsValue(LS_KEYS.NEVER_SHOW_AGAIN, true);
    } else {
      console.log("[PWA Install] ❌ Usuari ha REBUTJAT o tancat el diàleg.");
      // Podríem tractar el rebuig explícit igual que un 'dismiss' si volem
      // handleDismissAction();
    }
  } catch (error) {
    console.error(
      "[PWA Install] Error durant el procés de prompt/userChoice:",
      error
    );
  } finally {
    // Important: El prompt només es pot utilitzar una vegada.
    deferredInstallPrompt = null;
    // console.info('[PWA Install] deferredInstallPrompt resetejat a null.');
  }
}

/**
 * Configura els listeners per als botons d'instal·lar i descartar.
 */
function linkInstallControls() {
  if (installButtonElement) {
    installButtonElement.addEventListener("click", handleInstallAction);
    // console.info('[PWA Install] Listener afegit al botó d\'instal·lació.');
  } else {
    console.warn(
      "[PWA Install] No s'ha trobat el botó d'instal·lació (#install-button) per afegir listener."
    );
  }

  if (dismissButtonElement) {
    dismissButtonElement.addEventListener("click", handleDismissAction);
    // console.info('[PWA Install] Listener afegit al botó de descartar.');
  } else {
    console.warn(
      "[PWA Install] No s'ha trobat el botó de descartar (#dismiss-button) per afegir listener."
    );
  }
}

/**
 * Gestiona l'esdeveniment 'beforeinstallprompt'.
 * Emmagatzema l'esdeveniment per a un ús posterior.
 * @param {Event} event - L'objecte d'esdeveniment BeforeInstallPromptEvent.
 */
function handleBeforeInstallPrompt(event) {
  // Prevé el mini-infobar per defecte en alguns navegadors (Chrome Mobile)
  event.preventDefault();

  // Emmagatzema l'esdeveniment per poder cridar prompt() més tard
  deferredInstallPrompt = event;
  console.info(
    '[PWA Install] 📢 Event "beforeinstallprompt" capturat i emmagatzemat.'
  );

  // Decideix si vols mostrar el teu banner personalitzat immediatament
  // o esperar una acció específica de l'usuari o un altre moment.
  // Per exemple, per mostrar-lo directament:
  showInstallBanner();

  // Assegura't que els botons (si no estaven ja enllaçats) estiguin llestos
  // Això és útil si el DOM es carrega abans que l'esdeveniment es dispari
  if (installButtonElement && dismissButtonElement && !isInitialized) {
    // Potser no cal tornar a enllaçar si initPwaInstall ja ho ha fet.
    // console.log('[PWA Install] Botons ja haurien d'estar enllaçats per init.');
  }
}

/**
 * Monitoritza els canvis en el mode de visualització (per detectar instal·lacions/desinstal·lacions).
 */
function monitorDisplayModeChanges() {
  try {
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", (evt) => {
      if (evt.matches) {
        console.log(
          "[PWA Install] ✅ App detectada en mode standalone (instal·lada)."
        );
        setLsValue(LS_KEYS.IS_INSTALLED, true);
        hideInstallBanner(); // Amaga el banner si encara era visible
      } else {
        console.log("[PWA Install] ℹ️ App ha sortit del mode standalone.");
        // No eliminem IS_INSTALLED necessàriament, ja que l'usuari
        // podria haver-la instal·lat i després obrir-la al navegador.
        // Podria ser millor gestionar la desinstal·lació d'una altra manera si cal.
      }
    });
  } catch (error) {
    console.error(
      "[PWA Install] Error en configurar el monitor de display-mode:",
      error
    );
  }
}

/**
 * Inicialitza tota la lògica relacionada amb el prompt d'instal·lació de la PWA.
 * Aquesta funció s'hauria de cridar quan el DOM estigui llest.
 * @export
 */
export function initPwaInstall() {
  // Evita reinicialitzacions
  if (isInitialized) {
    console.warn("[PWA Install] Ja inicialitzat.");
    return;
  }

  // Comprovació inicial: si ja està instal·lada, no cal fer gairebé res més
  if (isAppInstalled()) {
    console.info("[PWA Install] App ja detectada com instal·lada a l'inici.");
    // Encara podem monitoritzar canvis per si es desinstal·la
    monitorDisplayModeChanges();
    isInitialized = true; // Marca com inicialitzat per evitar treball redundant
    return;
  }

  // Si l'usuari ha demanat no tornar a veure el prompt, només monitoritzem
  if (getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN)) {
    console.info(
      "[PWA Install] L'usuari ha demanat no veure més el prompt. Només es monitoritzarà l'estat."
    );
    monitorDisplayModeChanges();
    isInitialized = true;
    return;
  }

  console.info("[PWA Install] Inicialitzant gestor d'instal·lació PWA...");

  // Cacheja els elements del DOM necessaris
  installPromptElement = document.getElementById("install-prompt");
  installButtonElement = document.getElementById("install-button");
  dismissButtonElement = document.getElementById("dismiss-button");

  // Comprova si els elements essencials del banner existeixen
  if (!installPromptElement || !installButtonElement || !dismissButtonElement) {
    console.warn(
      "[PWA Install] Falten un o més elements del DOM per al banner personalitzat (#install-prompt, #install-button, #dismiss-button). La funcionalitat del banner pot estar limitada."
    );
    // Podem decidir si continuar sense el banner personalitzat o aturar-nos.
    // Continuarem només amb la captura de l'esdeveniment.
  } else {
    // Si tenim els elements, enllacem els controls
    linkInstallControls();
  }

  // Escolta l'esdeveniment clau
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  console.info('[PWA Install] Listener per a "beforeinstallprompt" afegit.');

  // Monitoritza canvis en el mode d'instal·lació
  monitorDisplayModeChanges();

  isInitialized = true;
  console.info(
    "[PWA Install] Gestor d'instal·lació PWA inicialitzat correctament."
  );
}

/**
 * Incrementa comptadors interns (si és necessari) i decideix si
 * mostrar el banner d'instal·lació després d'una acció clau de l'usuari (ex: descàrrega PDF).
 * Conté la lògica de "mostrar a la primera", "mostrar després de X accions si rebutjat 1 cop".
 * @export
 */
export function requestInstallPromptAfterAction() {
  // Comprovacions inicials (ja instal·lat, neverShow, no hi ha prompt disponible?)
  if (
    isAppInstalled() ||
    getLsBoolean(LS_KEYS.NEVER_SHOW_AGAIN) ||
    !deferredInstallPrompt
  ) {
    console.info(
      "[PWA Install] No es requereix acció de prompt (instal·lat, bloquejat o sense prompt)."
    );
    return;
  }

  const dismissCount = getLsNumber(LS_KEYS.TIMES_DISMISSED);
  console.log(
    `[PWA Install] Comprovant si mostrar prompt. Vegades descartat: ${dismissCount}`
  );

  if (dismissCount === 0) {
    // Primera vegada que es considera mostrar després d'una acció clau.
    // Podem afegir un retard per no ser intrusius.
    console.info(
      "[PWA Install] Programant mostra del banner (primera oportunitat post-acció)..."
    );
    setTimeout(() => {
      showInstallBanner(); // Mostra el banner personalitzat
    }, 3000); // Retard de 3 segons (ajustable)
  } else if (dismissCount === 1) {
    // L'usuari ja ho ha descartat un cop. Esperem més accions.
    // Aquesta lògica podria basar-se en un comptador d'accions (com l'antic pdfDownloadsSinceNo)
    // O simplement podríem decidir no tornar-ho a mostrar automàticament després d'un descart.
    // Exemple: Requereix X accions des de l'últim descart
    // let actionsSinceDismiss = getLsNumber(LS_KEYS.PDF_DOWNLOADS_SINCE_DISMISS); // Necessitaria una clau genèrica
    // actionsSinceDismiss++;
    // setLsValue(LS_KEYS.PDF_DOWNLOADS_SINCE_DISMISS, actionsSinceDismiss);
    // const ACTIONS_THRESHOLD = 5; // Ex: mostrar després de 5 accions més
    // if (actionsSinceDismiss >= ACTIONS_THRESHOLD) {
    //    console.info(`[PWA Install] Programant mostra del banner (${actionsSinceDismiss} accions des de l'últim descart)...`);
    //    setTimeout(() => {
    //        showInstallBanner();
    //    }, 3000);
    //    setLsValue(LS_KEYS.PDF_DOWNLOADS_SINCE_DISMISS, 0); // Reinicia el comptador
    // } else {
    //     console.info(`[PWA Install] Encara no s'han complert les ${ACTIONS_THRESHOLD} accions des de l'últim descart (${actionsSinceDismiss}).`);
    // }

    // Alternativa més simple: Si l'usuari ja ha dit NO un cop, no el molestem més automàticament.
    console.info(
      "[PWA Install] L'usuari ja ha descartat el banner un cop. No es mostrarà automàticament de nou."
    );
  }
  // Si dismissCount >= MAX_DISMISSALS, ja ho gestiona la comprovació inicial de NEVER_SHOW_AGAIN
}
