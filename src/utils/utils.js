// Importar constants centralitzades
import { DOM_IDS, DIET_TYPES, CSS_CLASSES } from "../config/constants.js";

// --- Constants locals ---
const DIET_TYPE_TEXT = {
  [DIET_TYPES.LUNCH]: "comida",
  [DIET_TYPES.DINNER]: "cena",
  DEFAULT: "dieta",
};
const EASTER_EGG_TAPS_REQUIRED = {
  TOP_BAR: CSS_CLASSES.TOP_BAR_TAPS,
  FOOTER: CSS_CLASSES.FOOTER_TAPS,
  TIMEOUT: CSS_CLASSES.TIMEOUT,
  ANIMATION_DURATION: CSS_CLASSES.ANIMATION_DURATION,
};

/**
 * Assigna el nonce CSP injectat via worker a un element si està disponible.
 * @param {HTMLElement} element - Element al qual aplicar el nonce.
 */
export function applyCspNonce(element) {
  if (!element) return;
  const body = document.body;
  if (!body) return;
  const nonce =
    body.dataset?.cspNonce || body.getAttribute("data-csp-nonce") || "";
  if (nonce && !element.getAttribute("nonce")) {
    element.setAttribute("nonce", nonce);
  }
}

// --- Funcions Públiques ---

/**
 * Estableix la data actual.
 * @export
 */
export function setTodaysDate() {
  try {
    const dateInput = document.getElementById(DOM_IDS.DATE_INPUT);
    if (!dateInput) return;

    dateInput.valueAsDate = new Date();
  } catch (error) {
    // Silenci si hi ha error
  }
}

/**
 * Capitalitza primera lletra.
 * @param {string} text
 * @returns {string}
 * @export
 */
export function capitalizeFirstLetter(text) {
  if (typeof text !== "string" || !text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Posa en majúscula les paraules d'una cadena de text amb regles especials:
 * - Les paraules normals es capitalitzen (Ex: "maria" -> "Maria").
 * - Les paraules que contenen un punt (considerades inicials) es posen
 *   totalment en majúscules (Ex: "l.f." -> "L.F.").
 * @param {string} str - La cadena a capitalitzar.
 * @returns {string} - La cadena capitalitzada.
 * @export
 */
export function capitalizeWords(str) {
  if (!str) return "";
  return str
    .split(" ")
    .map((word) => {
      // Si la paraula conté un punt, la tractem com una inicial i la posem tota en majúscules.
      if (word.includes(".")) {
        return word.toUpperCase();
      }
      // Si és una paraula normal, només capitalitzem la primera lletra.
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Obté tipus de dieta actual.
 * @returns {'lunch'|'dinner'}
 * @export
 */
export function getCurrentDietType() {
  const currentHour = new Date().getHours();
  return currentHour >= 6 && currentHour < 18
    ? DIET_TYPES.LUNCH
    : DIET_TYPES.DINNER;
}

/**
 * Estableix tipus de dieta per defecte.
 * @export
 */
export function setupDietTypeSelectBehaviour() {
  const dietTypeSelect = document.getElementById(DOM_IDS.DIET_TYPE_SELECT);
  if (!dietTypeSelect) return;
  dietTypeSelect.value = getCurrentDietType();
}

/**
 * Formata info de dieta.
 * @param {string} dietDate
 * @param {string|null} dietType
 * @returns {{ddmmaa: string, franjaText: string}}
 * @export
 */
export function getDietDisplayInfo(dietDate, dietType) {
  let ddmmaa = "Data invàlida";
  if (dietDate && /^\d{4}-\d{2}-\d{2}$/.test(dietDate)) {
    try {
      const parts = dietDate.split("-");
      const yy = parts[0].slice(-2);
      ddmmaa = `${parts[2]}/${parts[1]}/${yy}`;
    } catch (e) {
      // Silenci si hi ha error de format
    }
  }
  const franjaText = DIET_TYPE_TEXT[dietType] || DIET_TYPE_TEXT.DEFAULT;
  return { ddmmaa, franjaText };
}

// --- Easter Egg (Encapsulat per evitar globals) ---
const easterEggState = {
  topBarTaps: 0,
  footerTaps: 0,
  tapTimeoutId: null,
};

/**
 * Reseteja taps d'easter egg.
 */
function _resetEasterEggTaps() {
  easterEggState.topBarTaps = 0;
  easterEggState.footerTaps = 0;
  if (easterEggState.tapTimeoutId) {
    clearTimeout(easterEggState.tapTimeoutId);
    easterEggState.tapTimeoutId = null;
  }
}

/**
 * Mostra animació d'easter egg.
 */
function _showEasterEggAnimation() {
  if (document.querySelector(DOM_IDS.EASTER_EGG_OVERLAY)) return;

  const overlay = document.createElement("div");
  overlay.className = DOM_IDS.EASTER_EGG_OVERLAY.substring(1);

  const iconContainer = document.createElement("div");
  iconContainer.className = DOM_IDS.EASTER_EGG_ICON.substring(1);

  // Seguretat XSS: usar createElement en lloc de innerHTML
  const eggImg = document.createElement("img");
  eggImg.src = "assets/icons/egg.svg";
  eggImg.alt = "Easter Egg";
  iconContainer.appendChild(eggImg);

  overlay.appendChild(iconContainer);
  document.body.appendChild(overlay);

  const closeEasterEgg = (event) => {
    event.stopPropagation();
    iconContainer.classList.add("clicked");
    setTimeout(
      () => overlay.remove(),
      EASTER_EGG_TAPS_REQUIRED.ANIMATION_DURATION
    );
  };

  overlay.addEventListener("click", closeEasterEgg);
}

/**
 * Inicialitza easter egg.
 * @export
 */
export function activateEasterEgg() {
  const topBarElement = document.getElementById("top-bar");
  const footerElement = document.getElementById("footer");

  if (!topBarElement || !footerElement) return;

  topBarElement.addEventListener("touchend", (event) => {
    if (event.changedTouches.length === 1) {
      easterEggState.topBarTaps++;
      if (easterEggState.tapTimeoutId)
        clearTimeout(easterEggState.tapTimeoutId);
      easterEggState.tapTimeoutId = setTimeout(
        _resetEasterEggTaps,
        EASTER_EGG_TAPS_REQUIRED.TIMEOUT
      );

      if (easterEggState.topBarTaps > EASTER_EGG_TAPS_REQUIRED.TOP_BAR) {
        _resetEasterEggTaps();
      }
    } else {
      _resetEasterEggTaps();
    }
  });

  footerElement.addEventListener("touchend", (event) => {
    if (
      easterEggState.topBarTaps === EASTER_EGG_TAPS_REQUIRED.TOP_BAR &&
      event.changedTouches.length === 1
    ) {
      easterEggState.footerTaps++;
      if (easterEggState.tapTimeoutId)
        clearTimeout(easterEggState.tapTimeoutId);
      easterEggState.tapTimeoutId = setTimeout(
        _resetEasterEggTaps,
        EASTER_EGG_TAPS_REQUIRED.TIMEOUT
      );

      if (easterEggState.footerTaps === EASTER_EGG_TAPS_REQUIRED.FOOTER) {
        _showEasterEggAnimation();
        _resetEasterEggTaps();
      } else if (easterEggState.footerTaps > EASTER_EGG_TAPS_REQUIRED.FOOTER) {
        _resetEasterEggTaps();
      }
    }
  });
}

/**
 * Funció debounce reutilitzable per retardar execucions.
 * @param {Function} func - Funció a debounçar.
 * @param {number} delay - Temps d'espera en ms.
 * @returns {Function} Funció debounçada amb mètode .cancel().
 */
export function debounce(func, delay) {
  let timeout;
  const debounced = function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
}
