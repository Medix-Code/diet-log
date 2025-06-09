/**
 * @file utils.js
 * @description Funcions d'utilitat generals per a l'aplicació.
 * @module utils
 */

// --- Constants ---
const DOM_IDS = {
  DATE_INPUT: "date",
  DIET_TYPE_SELECT: "diet-type",
  TOP_BAR: ".top-bar", // Selector, no ID
  FOOTER: "footer", // Selector, no ID
  EASTER_EGG_OVERLAY: ".easter-egg-overlay", // Classe per a l'overlay
  EASTER_EGG_ICON: ".easter-egg-icon", // Classe per a la icona
};
const DIET_TYPES = {
  LUNCH: "lunch", // Dinar
  DINNER: "dinner", // Sopar
};
const DIET_TYPE_TEXT = {
  [DIET_TYPES.LUNCH]: "comida",
  [DIET_TYPES.DINNER]: "cena",
  DEFAULT: "dieta",
};
const EASTER_EGG_TAPS_REQUIRED = {
  // Configuració per a l'Easter Egg
  TOP_BAR: 3,
  FOOTER: 2,
  TIMEOUT: 1000, // ms per resetejar taps
  ANIMATION_DURATION: 1000, // ms
};

// --- Funcions Públiques ---

/**
 * Estableix la data actual al camp d'input de data.
 * @export
 */
export function setTodayDate() {
  const dateInput = document.getElementById(DOM_IDS.DATE_INPUT);
  if (!dateInput) {
    console.warn("Utils: Input de data no trobat.");
    return;
  }
  try {
    const now = new Date();
    // Format YYYY-MM-DD requerit per input type="date"
    dateInput.valueAsDate = now; // Mètode més fiable per a dates
    // Alternativa manual (si valueAsDate falla o es prefereix):
    // const year = now.getFullYear();
    // const month = String(now.getMonth() + 1).padStart(2, '0');
    // const day = String(now.getDate()).padStart(2, '0');
    // dateInput.value = `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Error establint la data d'avui:", error);
  }
}

/**
 * Capitalitza la primera lletra d'un text.
 * @param {string} text - El text a capitalitzar.
 * @returns {string} El text amb la primera lletra en majúscula.
 * @export
 */
export function capitalizeFirstLetter(text) {
  if (!text || typeof text !== "string") return "";
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase(); // Converteix la resta a minúscules per consistència
}

/**
 * Determina la franja horària ('lunch' o 'dinner') basada en l'hora actual.
 * @returns {('lunch'|'dinner')} La franja horària.
 * @export
 */
export function getCurrentDietType() {
  const currentHour = new Date().getHours();
  // De 6:00 a 17:59 és 'lunch', la resta és 'dinner'
  return currentHour >= 6 && currentHour < 18
    ? DIET_TYPES.LUNCH
    : DIET_TYPES.DINNER;
}

/**
 * Estableix el valor per defecte del selector de tipus de dieta basat en l'hora actual.
 * @export
 */
export function setDefaultDietSelect() {
  const dietSelect = document.getElementById(DOM_IDS.DIET_TYPE_SELECT);
  if (!dietSelect) {
    console.warn("Utils: Select de tipus de dieta no trobat.");
    return;
  }
  dietSelect.value = getCurrentDietType();
}

/**
 * Formata la informació d'una dieta per a visualització (data i tipus).
 * @param {string} dietDate - Data en format "YYYY-MM-DD".
 * @param {string|null} dietType - Tipus de dieta ('lunch', 'dinner', o null).
 * @returns {{ ddmmaa: string, franjaText: string }} Objecte amb data formatada i text de la franja.
 * @export
 */
export function getDietDisplayInfo(dietDate, dietType) {
  let ddmmaa = "Data invàlida";
  if (dietDate && /^\d{4}-\d{2}-\d{2}$/.test(dietDate)) {
    try {
      // Opció 1: Mantenir format DD/MM/YY
      const parts = dietDate.split("-");
      const yy = parts[0].slice(-2);
      ddmmaa = `${parts[2]}/${parts[1]}/${yy}`;
      // Opció 2: Usar Intl.DateTimeFormat per format localitzat (més robust)
      // const dateObj = new Date(dietDate + 'T00:00:00'); // Assegura hora local
      // ddmmaa = new Intl.DateTimeFormat(navigator.language || 'es-ES', {
      //    day: '2-digit', month: '2-digit', year: '2-digit'
      // }).format(dateObj);
    } catch (e) {
      console.error("Error formatant data:", e);
    }
  }

  const franjaText = DIET_TYPE_TEXT[dietType] || DIET_TYPE_TEXT.DEFAULT;

  return { ddmmaa, franjaText };
}

// --- Easter Egg ---
let topBarTaps = 0;
let footerTaps = 0;
let tapTimeoutId = null; // Per guardar l'ID del timeout

/** Reseteja els comptadors de taps per a l'Easter Egg. */
function _resetEasterEggTaps() {
  topBarTaps = 0;
  footerTaps = 0;
  if (tapTimeoutId) {
    clearTimeout(tapTimeoutId);
    tapTimeoutId = null;
  }
}

/** Mostra l'animació de l'Easter Egg. */
function _showEasterEggAnimation() {
  // Evita mostrar múltiples vegades si es fa tap molt ràpid
  if (document.querySelector(DOM_IDS.EASTER_EGG_OVERLAY)) return;

  const overlay = document.createElement("div");
  overlay.className = DOM_IDS.EASTER_EGG_OVERLAY.substring(1); // Treu el punt

  const iconContainer = document.createElement("div");
  iconContainer.className = DOM_IDS.EASTER_EGG_ICON.substring(1);
  // TODO: Definir la ruta a la icona d'ou com a constant
  iconContainer.innerHTML = `<img src="assets/icons/egg.svg" alt="Easter Egg">`;

  overlay.appendChild(iconContainer);
  document.body.appendChild(overlay);

  // Tancar i eliminar al clicar l'overlay o la icona
  const closeEasterEgg = (event) => {
    event.stopPropagation();
    iconContainer.classList.add("clicked"); // Inicia animació de sortida
    setTimeout(() => {
      overlay.remove();
    }, EASTER_EGG_TAPS_REQUIRED.ANIMATION_DURATION); // Espera animació
  };

  overlay.addEventListener("click", closeEasterEgg);
  // iconContainer.addEventListener('click', closeEasterEgg); // Clic a la icona també tanca

  // Opcional: Tancar automàticament després d'un temps
  // setTimeout(() => {
  //     if (document.body.contains(overlay)) { // Comprova si encara existeix
  //          iconContainer.classList.add('clicked');
  //          setTimeout(() => overlay.remove(), EASTER_EGG_TAPS_REQUIRED.ANIMATION_DURATION);
  //     }
  // }, 5000); // Tanca després de 5 segons
}

/** Inicialitza els listeners per a l'Easter Egg. */
export function easterEgg() {
  const topBarElement = document.querySelector(DOM_IDS.TOP_BAR);
  const footerElement = document.querySelector(DOM_IDS.FOOTER);

  if (!topBarElement || !footerElement) {
    console.warn("Easter Egg: No s'han trobat top bar o footer.");
    return;
  }

  // Listener per a la barra superior
  topBarElement.addEventListener("touchend", (event) => {
    // Considera només un toc
    if (event.changedTouches.length === 1) {
      topBarTaps++;
      console.log(`Top Bar Taps: ${topBarTaps}`);
      // Reinicia el timeout cada vegada
      if (tapTimeoutId) clearTimeout(tapTimeoutId);
      tapTimeoutId = setTimeout(
        _resetEasterEggTaps,
        EASTER_EGG_TAPS_REQUIRED.TIMEOUT
      );

      // Si arribem al número requerit, no cal esperar més aquí
      if (topBarTaps === EASTER_EGG_TAPS_REQUIRED.TOP_BAR) {
        console.log("Top Bar Taps OK. Esperant Footer Taps...");
        // No resetejem aquí, esperem els taps del footer
      } else if (topBarTaps > EASTER_EGG_TAPS_REQUIRED.TOP_BAR) {
        _resetEasterEggTaps(); // Reseteja si es fan més taps del compte
      }
    } else {
      _resetEasterEggTaps(); // Reseteja si hi ha multitouch
    }
  });

  // Listener per al peu de pàgina
  footerElement.addEventListener("touchend", (event) => {
    // Només si s'han fet els taps correctes a la top bar i és un sol toc
    if (
      topBarTaps === EASTER_EGG_TAPS_REQUIRED.TOP_BAR &&
      event.changedTouches.length === 1
    ) {
      footerTaps++;
      console.log(`Footer Taps: ${footerTaps}`);
      // Reinicia el timeout general
      if (tapTimeoutId) clearTimeout(tapTimeoutId);
      tapTimeoutId = setTimeout(
        _resetEasterEggTaps,
        EASTER_EGG_TAPS_REQUIRED.TIMEOUT
      );

      // Si completem la seqüència
      if (footerTaps === EASTER_EGG_TAPS_REQUIRED.FOOTER) {
        console.log("Easter Egg Triggered!");
        _showEasterEggAnimation();
        _resetEasterEggTaps(); // Reseteja per poder tornar a activar
      } else if (footerTaps > EASTER_EGG_TAPS_REQUIRED.FOOTER) {
        _resetEasterEggTaps(); // Reseteja si es fan més taps del compte
      }
    }
    // No resetejem si fallen els taps del footer però els de la top bar eren correctes,
    // per donar oportunitat de corregir només els del footer dins del timeout.
  });
  console.log("Easter Egg inicialitzat.");
}
