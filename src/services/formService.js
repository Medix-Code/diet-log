/**
 * @file formService.js
 * @description Gestiona l'estat del formulari, la recollida de dades,
 *              la detecció de canvis i activa l'autoguardat amb feedback visual.
 * @module formService
 */

// --- Imports ---
import {
  getSignatureConductor,
  getSignatureAjudant,
} from "./signatureService.js";
import { getCurrentDietType } from "../utils/utils.js";
import { updateServicePanelsForServiceType } from "./servicesPanelManager.js";
import { autoSaveDiet } from "./dietService.js";
import { showHasChanges, hideIndicator } from "../ui/saveIndicator.js";

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------
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
const INPUT_CHANGE_DEBOUNCE_MS = 300; // Debounce per a la detecció de canvis
const AUTOSAVE_DELAY_MS = 3000; // 3 segons d'espera per a l'autoguardat

// ---------------------------------------------------------------------------
// ESTAT INTERN
// ---------------------------------------------------------------------------
let initialFormDataStr = "";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Debounce amb mètode de cancel·lació */
const debounce = (fn, wait) => {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
  debounced.cancel = () => {
    clearTimeout(t);
  };
  return debounced;
};

// Funció d'autoguardat amb debounce
const debouncedAutoSave = debounce(autoSaveDiet, AUTOSAVE_DELAY_MS);

/**
 * Funció central: recull totes les dades del formulari.
 */
function getFormDataObject() {
  try {
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

// ---------------------------------------------------------------------------
// FUNCIONS PÚBLIQUES
// ---------------------------------------------------------------------------

/**
 * Funció per capturar l'estat inicial del formulari. Aquesta és la funció
 * que "reseteja" l'estat a "guardat".
 */
export function captureInitialFormState() {
  initialFormDataStr = JSON.stringify(getFormDataObject() || {});
  // En capturar un nou estat, forcem una re-avaluació.
  // Com que currentState i initialFormDataStr seran iguals,
  // handleFormChange desactivarà el botó i l'indicador.
  handleFormChange();
}

/**
 * Funció per actualitzar l'estat del botó "Guardar" del menú.
 * @param {boolean} enabled - True per activar, false per desactivar.
 */
export function setSaveButtonState(enabled) {
  const saveBtn = document.getElementById("save-diet");
  if (saveBtn) {
    saveBtn.disabled = !enabled;
  }
}

/**
 * Funció que gestiona els canvis al formulari.
 */
function handleFormChange() {
  debouncedAutoSave.cancel();
  const currentState = JSON.stringify(getFormDataObject() || {});

  if (currentState !== initialFormDataStr) {
    setSaveButtonState(true);
    showHasChanges();
    const service1Input = document.getElementById("service-number-1");
    if (service1Input && service1Input.value.trim().length === 9) {
      debouncedAutoSave();
    }
  } else {
    // Si no hi ha canvis, ens assegurem que tot estigui desactivat.
    setSaveButtonState(false);
    hideIndicator();
  }
}

/**
 * Força una re-avaluació de l'estat del formulari.
 */
export function revalidateFormState() {
  handleFormChange();
}

/**
 * Afegeix listeners (delegació) per detectar canvis al formulari.
 */
export function addInputListeners() {
  const container = document.getElementById(FORM_CONTAINER_ID);
  if (!container) return;

  // Usem un debounce per no saturar la funció handleFormChange
  const debouncedHandler = debounce(handleFormChange, INPUT_CHANGE_DEBOUNCE_MS);

  container.addEventListener("input", debouncedHandler);
  container.addEventListener("change", debouncedHandler);

  const dateInput = document.getElementById(IDS.DATE);
  dateInput?.addEventListener("change", () => {
    dateInput.blur();
    debouncedHandler();
  });
}

/**
 * Afegeix el listener al selector de tipus de servei.
 */
export function addServiceTypeListener() {
  const serviceTypeSelect = document.getElementById(IDS.SERVICE_TYPE);
  if (!serviceTypeSelect) return;

  serviceTypeSelect.addEventListener("change", (event) => {
    const selectedType = event.target.value;
    updateServicePanelsForServiceType(selectedType);
    try {
      localStorage.setItem(LS_SERVICE_TYPE_KEY, selectedType);
      console.log(`[LocalStorage] Tipus de servei desat: ${selectedType}`);
    } catch (error) {
      console.error("Error desant el tipus de servei a localStorage:", error);
    }
  });
}

/**
 * Funció per cancel·lar l'autoguardat pendent.
 */
export function cancelPendingAutoSave() {
  debouncedAutoSave.cancel();
}

/**
 * Tanca el teclat en prémer Enter als inputs amb enterkeyhint="done".
 */
export function addDoneBehavior() {
  const c = document.getElementById(FORM_CONTAINER_ID);
  if (!c) return;
  c.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches('input[enterkeyhint="done"]')) {
      e.preventDefault();
      e.target.blur();
    }
  });
}

/**
 * Retorna totes les dades del formulari en format objecte.
 */
export const gatherAllData = () => getFormDataObject();

/**
 * (Helper) Retorna l'estat inicial del formulari en format string.
 */
export const getInitialFormDataStr = () => initialFormDataStr;
