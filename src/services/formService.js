/**
 * @file formService.js
 * @description Gestiona l'estat del formulari, la recollida de dades,
 *              la detecció de canvis i activa l'autoguardat amb feedback visual.
 * @module formService
 */

// ────────────────────────────────────────────────────────────
// IMPORTS
// ────────────────────────────────────────────────────────────
import {
  getSignatureConductor,
  getSignatureAjudant,
} from "./signatureService.js";
import { getCurrentDietType } from "../utils/utils.js";
import { updateServicePanelsForServiceType } from "./servicesPanelManager.js";
import { autoSaveDiet } from "./dietService.js";
import { indicateUnsaved, hideIndicator } from "../ui/saveIndicator.js";

// ────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────
const SERVICE_CONTAINER_SELECTOR = ".service";
const FORM_CONTAINER_ID = "main-content";

const IDS = {
  DATE: "date",
  DIET_TYPE: "diet-type",
  VEHICLE: "vehicle-number",
  P1: "person1",
  P2: "person2",
  SERVICE_TYPE: "service-type",
  SAVE_BTN: "save-diet",
};

const LS_SERVICE_TYPE_KEY = "userSelectedServiceType";

const SERVICE_FIELD_SELECTORS = {
  serviceNumber: ".service-number",
  origin: ".origin",
  originTime: ".origin-time",
  destination: ".destination",
  destinationTime: ".destination-time",
  endTime: ".end-time",
};

const CHIP_ACTIVE_CLASS = "chip-active";
const INPUT_CHANGE_DEBOUNCE_MS = 300; // delay per a la detecció de canvis
const AUTOSAVE_DELAY_MS = 3000; // 3 s d’espera per a l’autoguardat

// ────────────────────────────────────────────────────────────
// ESTAT INTERN
// ────────────────────────────────────────────────────────────
let initialFormDataStr = "";

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────

/** Debounce amb mètode de cancel·lació. */
const debounce = (fn, wait) => {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
  debounced.cancel = () => clearTimeout(t);
  return debounced;
};

// Funció d'autoguardat amb debounce
const debouncedAutoSave = debounce(autoSaveDiet, AUTOSAVE_DELAY_MS);

/** Comprova si el formulari mínim ja està llest per guardar. */
function isFormReadyForSave() {
  const dateOk = !!document.getElementById(IDS.DATE)?.value;
  const typeOk = !!document.getElementById(IDS.DIET_TYPE)?.value;
  const svcNumOk =
    document.getElementById("service-number-1")?.value.trim().length === 9;
  return dateOk && typeOk && svcNumOk;
}

/** Retorna totes les dades del formulari en un objecte estructurat. */
function getFormDataObject() {
  try {
    // ─ Dades generals
    const g = {
      date: document.getElementById(IDS.DATE)?.value.trim() || "",
      dietType:
        document.getElementById(IDS.DIET_TYPE)?.value.trim() ||
        getCurrentDietType(),
      vehicleNumber: document.getElementById(IDS.VEHICLE)?.value.trim() || "",
      person1: document.getElementById(IDS.P1)?.value.trim() || "",
      person2: document.getElementById(IDS.P2)?.value.trim() || "",
      serviceType:
        document.getElementById(IDS.SERVICE_TYPE)?.value.trim() || "TSU",
      signatureConductor: getSignatureConductor(),
      signatureAjudant: getSignatureAjudant(),
    };

    // ─ Serveis
    const serviceEls = document.querySelectorAll(SERVICE_CONTAINER_SELECTOR);
    const services = Array.from(serviceEls).map((panel) => {
      const s = {};
      Object.entries(SERVICE_FIELD_SELECTORS).forEach(([k, sel]) => {
        s[k] = panel.querySelector(sel)?.value.trim() || "";
      });
      const activeChip = panel.querySelector(`.chip.${CHIP_ACTIVE_CLASS}`);
      s.mode = activeChip?.dataset.mode || "3.6";
      return s;
    });

    return { generalData: g, servicesData: services };
  } catch (err) {
    console.error("[FormService] Error recollint dades:", err);
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// FUNCIONS PÚBLIQUES
// ────────────────────────────────────────────────────────────

/** Captura l'estat inicial del formulari (punt de “sense canvis”). */
export function captureInitialFormState() {
  initialFormDataStr = JSON.stringify(getFormDataObject() || {});
  // Forcem una re-avaluació perquè el botó / indicador es posin al seu lloc.
  handleFormChange();
}

/** Activa o desactiva el botó “Guardar” del menú contextual. */
export function setSaveButtonState(enabled) {
  const btn = document.getElementById(IDS.SAVE_BTN);
  if (!btn) return;

  btn.disabled = !enabled;
  btn.setAttribute("aria-disabled", !enabled);
  btn.classList.toggle("is-disabled", !enabled);
}

/** Callback principal per a qualsevol canvi de formulari. */
function handleFormChange() {
  // Aturem qualsevol autoguardat pendent
  debouncedAutoSave.cancel();

  const currentState = JSON.stringify(getFormDataObject() || {});
  const hasChanges = currentState !== initialFormDataStr;

  if (!hasChanges) {
    setSaveButtonState(false);
    hideIndicator();
    return;
  }

  // Hi ha canvis
  indicateUnsaved();

  // Només mostrem el botó i programem l'autoguardat si el formulari és vàlid
  const enable = isFormReadyForSave();
  setSaveButtonState(enable);

  if (enable) debouncedAutoSave();
}

/** Força una re-avaluació manual de l'estat del formulari. */
export function revalidateFormState() {
  handleFormChange();
}

/** Afegeix listeners “input/change” amb delegació al contenidor principal. */
export function addInputListeners() {
  const container = document.getElementById(FORM_CONTAINER_ID);
  if (!container) return;

  const debouncedHandler = debounce(handleFormChange, INPUT_CHANGE_DEBOUNCE_MS);

  container.addEventListener("input", debouncedHandler);
  container.addEventListener("change", debouncedHandler);

  // Evitem que el date-picker quedi obert després d'escollir data (UX mòbil)
  const dateInput = document.getElementById(IDS.DATE);
  dateInput?.addEventListener("change", () => {
    dateInput.blur();
    debouncedHandler();
  });
}

/** Listener de canvi de selector de tipus de servei (TSU, TAP, …). */
export function addServiceTypeListener() {
  const select = document.getElementById(IDS.SERVICE_TYPE);
  if (!select) return;

  select.addEventListener("change", (e) => {
    const selected = e.target.value;
    updateServicePanelsForServiceType(selected);
    try {
      localStorage.setItem(LS_SERVICE_TYPE_KEY, selected);
      console.log(`[LocalStorage] Tipus de servei desat: ${selected}`);
    } catch (err) {
      console.error(
        "No s’ha pogut desar el tipus de servei a localStorage",
        err
      );
    }
  });
}

/** Cancel·la qualsevol autoguardat pendent (p. ex. abans d’un guardat manual). */
export function cancelPendingAutoSave() {
  debouncedAutoSave.cancel();
}

/** Tanca el teclat mòbil en prémer Enter als inputs amb enterkeyhint="done". */
export function addDoneBehavior() {
  const container = document.getElementById(FORM_CONTAINER_ID);
  if (!container) return;

  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches('input[enterkeyhint="done"]')) {
      e.preventDefault();
      e.target.blur();
    }
  });
}

/** Retorna totes les dades actuals del formulari. */
export const gatherAllData = () => getFormDataObject();

/** Helper per a tests: retorna l’instant “sense canvis” serialitzat. */
export const getInitialFormDataStr = () => initialFormDataStr;
