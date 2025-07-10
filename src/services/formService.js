/**
 * @file formService.js
 * @description Gestiona l'estat del formulari, la detecció de canvis
 *              i l'autoguardat amb feedback visual “Google-Docs style”.
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
import {
  indicateUnsaved,
  resetDirty,
  indicateSaving,
  indicateSaved,
  indicateSaveError,
} from "../ui/saveIndicator.js";

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

// ─ Temps i animacions
const INPUT_CHANGE_DEBOUNCE_MS = 150; // resposta ràpida
const DELAY_UNSAVED = 400; // apareix la píndola a 0,4 s
const AUTOSAVE_DELAY_MS = 1000; // autosave ≃ 1 s desp. del darrer canvi
const MIN_SPINNER_VISIBLE_MS = 300; // spinner mínim

// ────────────────────────────────────────────────────────────
// ESTAT INTERN
// ────────────────────────────────────────────────────────────
let initialFormDataStr = ""; // “foto” després del darrer guardat
let saveStart = 0; // per calcular la durada del spinner

// ────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────
const debounce = (fn, wait) => {
  let t;
  const debounced = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
  debounced.cancel = () => clearTimeout(t);
  return debounced;
};

/** És prou complet per guardar? */
function isFormReadyForSave() {
  const dateOk = !!document.getElementById(IDS.DATE)?.value;
  const typeOk = !!document.getElementById(IDS.DIET_TYPE)?.value;
  const svcNum = document.getElementById("service-number-1")?.value.trim();
  const svcNumOk = /^\d{9}$/.test(svcNum); // 9 xifres exactes
  return dateOk && typeOk && svcNumOk;
}

/** Hi ha canvis respecte l'últim “save”? */
function hasPendingChanges() {
  return JSON.stringify(getFormDataObject() || {}) !== initialFormDataStr;
}

/** Construeix un objecte amb totes les dades del formulari */
function getFormDataObject() {
  try {
    const generalData = {
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

    const servicesData = Array.from(
      document.querySelectorAll(SERVICE_CONTAINER_SELECTOR)
    ).map((panel) => {
      const s = {};
      for (const [k, sel] of Object.entries(SERVICE_FIELD_SELECTORS)) {
        s[k] = panel.querySelector(sel)?.value.trim() || "";
      }
      const activeChip = panel.querySelector(`.chip.${CHIP_ACTIVE_CLASS}`);
      s.mode = activeChip?.dataset.mode || "3.6";
      return s;
    });

    return { generalData, servicesData };
  } catch (err) {
    console.error("[FormService] Error recollint dades:", err);
    return null;
  }
}

/** Guarda amb spinner mínim i gestió d'errors */
async function triggerAutoSave() {
  if (!isFormReadyForSave() || !hasPendingChanges()) return;

  try {
    saveStart = Date.now();
    indicateSaving();

    await autoSaveDiet(); // ← pot llençar error

    const elapsed = Date.now() - saveStart;
    setTimeout(indicateSaved, Math.max(0, MIN_SPINNER_VISIBLE_MS - elapsed));

    // Actualitzem la “foto” post-guardat
    initialFormDataStr = JSON.stringify(getFormDataObject() || {});
  } catch (err) {
    console.warn("[Autosave skipped]", err.message);
    indicateSaveError("Revisa dades de Serveis");
  }
}

const debouncedAutoSave = debounce(triggerAutoSave, AUTOSAVE_DELAY_MS);

// ────────────────────────────────────────────────────────────
// PUBLIC API
// ────────────────────────────────────────────────────────────
export function captureInitialFormState() {
  initialFormDataStr = JSON.stringify(getFormDataObject() || {});
  handleFormChange(); // prim. avaluació
}

export function setSaveButtonState(enabled) {
  const b = document.getElementById(IDS.SAVE_BTN);
  if (!b) return;
  b.disabled = !enabled;
  b.setAttribute("aria-disabled", !enabled);
  b.classList.toggle("is-disabled", !enabled);
}

function handleFormChange() {
  debouncedAutoSave.cancel();

  if (!hasPendingChanges()) {
    setSaveButtonState(false);
    resetDirty();
    return;
  }

  if (isFormReadyForSave()) {
    //indicateUnsaved(DELAY_UNSAVED);
    setSaveButtonState(true);
    debouncedAutoSave();
  } else {
    setSaveButtonState(false);
    resetDirty();
  }
}

export const revalidateFormState = handleFormChange;

export function addInputListeners() {
  const container = document.getElementById(FORM_CONTAINER_ID);
  if (!container) return;

  const debouncedHandler = debounce(handleFormChange, INPUT_CHANGE_DEBOUNCE_MS);
  container.addEventListener("input", debouncedHandler);
  container.addEventListener("change", debouncedHandler);

  // flush immediat en deixar un camp
  container.addEventListener(
    "blur",
    (e) => {
      if (e.target.matches("input, select, textarea")) {
        handleFormChange(); // ① actualitza pending-changes ara mateix
        if (isFormReadyForSave() && hasPendingChanges()) {
          cancelPendingAutoSave();
          triggerAutoSave(); // ② guarda immediat
        }
      }
    },
    true
  );

  // UX mòbil per al date-picker
  const dateInput = document.getElementById(IDS.DATE);
  dateInput?.addEventListener("change", () => {
    dateInput.blur();
    debouncedHandler();
  });

  // Save d'emergència en sortir de la pàgina
  window.addEventListener("beforeunload", () => {
    cancelPendingAutoSave();
    if (isFormReadyForSave()) autoSaveDiet();
  });
}

export function addServiceTypeListener() {
  const select = document.getElementById(IDS.SERVICE_TYPE);
  if (!select) return;

  select.addEventListener("change", (e) => {
    const v = e.target.value;
    updateServicePanelsForServiceType(v);
    try {
      localStorage.setItem(LS_SERVICE_TYPE_KEY, v);
    } catch (er) {
      console.error("No s’ha pogut desar tipus servei", er);
    }
  });
}

export const cancelPendingAutoSave = () => debouncedAutoSave.cancel();
export const addDoneBehavior = () => {
  const c = document.getElementById(FORM_CONTAINER_ID);
  c?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.matches('input[enterkeyhint="done"]')) {
      e.preventDefault();
      e.target.blur();
    }
  });
};

export const gatherAllData = () => getFormDataObject();
export const getInitialFormDataStr = () => initialFormDataStr;
