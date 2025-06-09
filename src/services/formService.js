/**
 * @file formService.js
 * @description Gestiona l'estat del formulari principal, la recollida de dades,
 *              la detecció de canvis i la interacció bàsica dels inputs.
 * @module formService
 */

import {
  getSignatureConductor,
  getSignatureAjudant,
} from "./signatureService.js";
import { getCurrentDietType } from "../utils/utils.js";

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
  EMPRESA: "empresa",
  SAVE_BTN: "save-diet",
};

const SERVICE_FIELD_SELECTORS = {
  serviceNumber: ".service-number",
  origin: ".origin",
  originTime: ".origin-time",
  destination: ".destination",
  destinationTime: ".destination-time",
  endTime: ".end-time",
};

const CHIP_ACTIVE_CLASS = "chip-active"; // <─ FIX: classe literal

// ---------------------------------------------------------------------------
// ESTAT INTERN
// ---------------------------------------------------------------------------
let initialFormDataStr = ""; // stringificat de l’estat inicial
let saveBtnEl = null;
let saveButtonElement = null;
const DEBOUNCE_MS = 300;
// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Debounce bàsic */
const debounce = (fn, wait) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(null, args), wait);
  };
};

/**
 * Funció central: recull totes les dades del formulari i retorna
 * { generalData, servicesData }.
 * Afegeix als serveis el camp `mode` (3.6 / 3.22 / 3.11) segons el chip actiu.
 */
function getFormDataObject() {
  try {
    /* — General — */
    const g = {
      date: document.getElementById(IDS.DATE)?.value.trim() || "",
      dietType:
        document.getElementById(IDS.DIET_TYPE)?.value.trim() ||
        getCurrentDietType(),
      vehicleNumber: document.getElementById(IDS.VEHICLE)?.value.trim() || "",
      person1: document.getElementById(IDS.P1)?.value.trim() || "",
      person2: document.getElementById(IDS.P2)?.value.trim() || "",
      empresa: document.getElementById(IDS.EMPRESA)?.value.trim() || "",
      signatureConductor: getSignatureConductor(),
      signatureAjudant: getSignatureAjudant(),
    };

    /* — Serveis — */
    const serviceEls = document.querySelectorAll(SERVICE_CONTAINER_SELECTOR);

    const services = Array.from(serviceEls).map((panel) => {
      const s = {};
      Object.entries(SERVICE_FIELD_SELECTORS).forEach(([k, sel]) => {
        s[k] = panel.querySelector(sel)?.value.trim() || "";
      });
      /* NOVETAT ➜ mode del servei (chip actiu) */
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

/** Desa l’estat inicial del formulari */
export function captureInitialFormState() {
  initialFormDataStr = JSON.stringify(getFormDataObject() || {});
  checkIfFormChanged(); // desactiva botó guardar
}

/** Retorna l’state inicial en format string */
export const getInitialFormDataStr = () => initialFormDataStr;

/** Comprova canvis i habilita/deshabilita botó Guardar */
export function checkIfFormChanged() {
  if (!saveBtnEl) saveBtnEl = document.getElementById(IDS.SAVE_BTN);

  const changed =
    JSON.stringify(getFormDataObject() || {}) !== initialFormDataStr;

  if (saveBtnEl) {
    saveBtnEl.disabled = !changed;
    saveBtnEl.classList.toggle(CSS.DISABLED_BTN, !changed);
  }
}

/** Afegim listeners (delegació) per detectar canvis */
export function addInputListeners() {
  const container = document.getElementById(FORM_CONTAINER_ID);
  if (!container) return;

  const debounced = debounce(checkIfFormChanged, DEBOUNCE_MS);

  container.addEventListener("input", debounced);
  container.addEventListener("change", debounced);

  // cas especial DATE en Firefox
  const dateInput = document.getElementById(IDS.DATE);
  dateInput?.addEventListener("change", () => {
    dateInput.blur();
    debounced();
  });
}

/** Tanca el teclat en prémer Enter als inputs amb enterkeyhint="done" */
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

/** Retorna totes les dades (objecte) */
export const gatherAllData = () => getFormDataObject();

/** Treu els estils d’error d’un panell de servei */
export function removeErrorClassesFromService(panel) {
  if (!panel) return;
  Object.values(SERVICE_FIELD_SELECTORS).forEach((sel) =>
    panel.querySelector(sel)?.classList.remove(CSS.INPUT_ERROR)
  );
}

// ---------------------------------------------------------------------------
// “Compat” helpers que alguns mòduls antics encara fan servir
// ---------------------------------------------------------------------------
export function setInitialFormDataStr(str) {
  initialFormDataStr = str || "";
}
export function getAllFormDataAsString() {
  return JSON.stringify(getFormDataObject() || {});
}
