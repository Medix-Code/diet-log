// Gestiona formularis: estats, canvis, autoguardat
// Imports necessaris

import { sanitizeText } from "../utils/validation.js";
import {
  sanitizeAndValidate,
  validateTime,
  validateServiceNumber,
} from "../utils/inputSanitizer.js";
import {
  getSignatureConductor,
  getSignatureAjudant,
} from "./signatureService.js";
import { getCurrentDietType, debounce } from "../utils/utils.js";
import {
  updateServicePanelsForServiceType,
  serviceNotes,
} from "./servicesPanelManager.js";
import { autoSaveDiet } from "./dietService.js";
import {
  resetDirty,
  indicateSaving,
  indicateSaved,
  indicateSaveError,
} from "../ui/saveIndicator.js";
import { logger } from "../utils/logger.js";

const log = logger.withScope("FormService");

// Constants bàsiques
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

// Temps i animacions
const INPUT_CHANGE_DEBOUNCE_MS = 800; // Augmentat de 150ms a 800 per donar temps a escriure números llargs
const AUTOSAVE_DELAY_MS = 1000;
const MIN_SPINNER_VISIBLE_MS = 300;

// Classe principal
class FormService {
  constructor() {
    this.initialFormDataStr = "";
    this.saveStart = 0;
    this.debouncedAutoSave = debounce(
      this.triggerAutoSave.bind(this),
      AUTOSAVE_DELAY_MS
    );
    this.debouncedHandler = debounce(
      this.handleInputChange.bind(this),
      INPUT_CHANGE_DEBOUNCE_MS
    );
  }

  // Comprova si el formulari està llest per guardar
  isFormReadyForSave() {
    try {
      const dateOk = !!document.getElementById(IDS.DATE)?.value.trim();
      const typeOk = !!document.getElementById(IDS.DIET_TYPE)?.value.trim();
      const svcNum = document.getElementById("service-number-1")?.value.trim();
      const svcNumOk = /^\d{9}$/.test(svcNum);
      return dateOk && typeOk && svcNumOk;
    } catch (err) {
      console.warn("[FormService] Error validant formulari:", err);
      return false;
    }
  }

  // Comprova si hi ha canvis pendents
  hasPendingChanges() {
    return (
      JSON.stringify(this.getFormDataObject() || {}) !== this.initialFormDataStr
    );
  }

  // Recull dades del formulari en objecte
  getFormDataObject() {
    try {
      // Validació i sanitització de dades generals
      const dateValue = sanitizeText(document.getElementById(IDS.DATE)?.value);
      const vehicleValue = sanitizeText(document.getElementById(IDS.VEHICLE)?.value);
      const person1Value = sanitizeText(document.getElementById(IDS.P1)?.value);
      const person2Value = sanitizeText(document.getElementById(IDS.P2)?.value);
      
      // Validacions semàntiques
      const vehicleValidation = sanitizeAndValidate(vehicleValue, 'vehicleNumber');
      const person1Validation = sanitizeAndValidate(person1Value, 'personName');
      const person2Validation = sanitizeAndValidate(person2Value, 'personName');
      
      if (vehicleValue && !vehicleValidation.valid) {
        log.warn('Número de vehicle invàlid:', vehicleValidation.reason);
      }
      if (person1Value && !person1Validation.valid) {
        log.warn('Nom conductor invàlid:', person1Validation.reason);
      }
      if (person2Value && !person2Validation.valid) {
        log.warn('Nom ajudant invàlid:', person2Validation.reason);
      }
      
      const generalData = {
        date: dateValue,
        dietType: sanitizeText(
          document.getElementById(IDS.DIET_TYPE)?.value || getCurrentDietType()
        ),
        vehicleNumber: vehicleValidation.valid ? vehicleValidation.sanitized : '',
        person1: person1Validation.valid ? person1Validation.sanitized : '',
        person2: person2Validation.valid ? person2Validation.sanitized : '',
        serviceType: sanitizeText(
          document.getElementById(IDS.SERVICE_TYPE)?.value || "TSU"
        ),
        signatureConductor: getSignatureConductor(),
        signatureAjudant: getSignatureAjudant(),
      };

      const servicesData = Array.from(
        document.querySelectorAll(SERVICE_CONTAINER_SELECTOR)
      ).map((panel, index) => {
        const s = {};
        for (const [k, sel] of Object.entries(SERVICE_FIELD_SELECTORS)) {
          // Salta selectors buits (com 'notes' que es gestiona per separat)
          if (!sel) {
            s[k] = "";
            continue;
          }
          const rawValue = sanitizeText(panel.querySelector(sel)?.value);
          
          // Validacions semàntiques per camp
          if (k === 'serviceNumber' && rawValue) {
            if (!validateServiceNumber(rawValue)) {
              log.warn(`Número de servei ${index + 1} invàlid:`, rawValue);
              s[k] = ''; // Rebutja valor invàlid
            } else {
              s[k] = rawValue;
            }
          } else if ((k === 'originTime' || k === 'destinationTime' || k === 'endTime') && rawValue) {
            if (!validateTime(rawValue)) {
              log.warn(`Hora invàlida en servei ${index + 1}, camp ${k}:`, rawValue);
              s[k] = ''; // Rebutja valor invàlid
            } else {
              s[k] = rawValue;
            }
          } else {
            // Altres camps amb validació general
            const validation = sanitizeAndValidate(rawValue, 'text');
            s[k] = validation.valid ? validation.sanitized : '';
          }
        }
        const activeChip = panel.querySelector(`.chip.${CHIP_ACTIVE_CLASS}`);
        s.mode = activeChip?.dataset.mode || "3.6";

        s.notes = serviceNotes[index] || "";

        return s;
      });

      return { generalData, servicesData };
    } catch (err) {
      console.error("[FormService] Error recollint dades:", err);
      return null;
    }
  }

  // Activa autoguardat amb feedback
  async triggerAutoSave() {
    if (!this.isFormReadyForSave() || !this.hasPendingChanges()) return;

    try {
      this.saveStart = Date.now();
      indicateSaving();

      await autoSaveDiet();

      const elapsed = Date.now() - this.saveStart;
      setTimeout(indicateSaved, Math.max(0, MIN_SPINNER_VISIBLE_MS - elapsed));

      this.initialFormDataStr = JSON.stringify(this.getFormDataObject() || {});
    } catch (err) {
      console.warn("[Autosave skipped]", err?.message || "Error desconegut");
      indicateSaveError("Revisa dades de Serveis");
    }
  }

  // Guarda estat inicial del formulari
  captureInitialFormState() {
    this.initialFormDataStr = JSON.stringify(this.getFormDataObject() || {});
    this.handleFormChange();
  }

  // Actualitza estat del botó guardar
  setSaveButtonState(enabled) {
    const b = document.getElementById(IDS.SAVE_BTN);
    if (!b) return;
    b.disabled = !enabled;
    b.setAttribute("aria-disabled", !enabled ? "true" : "false");
    b.classList.toggle("is-disabled", !enabled);
  }

  // Gestiona canvis al formulari
  handleFormChange() {
    this.debouncedAutoSave.cancel();

    if (!this.hasPendingChanges()) {
      this.setSaveButtonState(false);
      resetDirty();
      return;
    }

    if (this.isFormReadyForSave()) {
      this.setSaveButtonState(true);
      // Dispara l'autoguardat (amb debounce)
      this.debouncedAutoSave();
    } else {
      this.setSaveButtonState(false);
      resetDirty();
    }
  }

  // Manejador de canvis d'input
  handleInputChange() {
    this.handleFormChange();
  }

  // Afegeix listeners per inputs i canvis
  addInputListeners() {
    const container = document.getElementById(FORM_CONTAINER_ID);
    if (!container) return;

    container.addEventListener("input", this.debouncedHandler);
    container.addEventListener("change", this.debouncedHandler);

    container.addEventListener(
      "blur",
      (e) => {
        if (e.target.matches("input, select, textarea")) {
          this.handleFormChange();
          if (this.isFormReadyForSave() && this.hasPendingChanges()) {
            this.debouncedAutoSave.cancel();
            this.triggerAutoSave();
          }
        }
      },
      true
    );

    const dateInput = document.getElementById(IDS.DATE);
    dateInput?.addEventListener("change", () => {
      dateInput.blur();
      this.debouncedHandler();
    });

    window.addEventListener("beforeunload", () => {
      this.debouncedAutoSave.cancel();
      if (this.isFormReadyForSave()) autoSaveDiet();
    });
  }

  // Listener per canvi de tipus de servei
  addServiceTypeListener() {
    const select = document.getElementById(IDS.SERVICE_TYPE);
    if (!select) return;

    select.addEventListener("change", (e) => {
      const v = e.target.value.trim();
      updateServicePanelsForServiceType(v);
      try {
        localStorage.setItem(LS_SERVICE_TYPE_KEY, v);
      } catch (err) {
        console.error("No s’ha pogut desar tipus servei", err);
      }
    });
  }

  cancelPendingAutoSave() {
    this.debouncedAutoSave.cancel();
  }

  addDoneBehavior() {
    const c = document.getElementById(FORM_CONTAINER_ID);
    c?.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.matches('input[enterkeyhint="done"]')) {
        e.preventDefault();
        e.target.blur();
      }
    });
  }

  gatherAllData() {
    return this.getFormDataObject();
  }

  getInitialFormDataStr() {
    return this.initialFormDataStr;
  }
}

// Instància única
const formService = new FormService();

// Exportar mètodes públics
export const captureInitialFormState = () =>
  formService.captureInitialFormState();
export const setSaveButtonState = (enabled) =>
  formService.setSaveButtonState(enabled);
export const revalidateFormState = () => formService.handleFormChange();
export const addInputListeners = () => formService.addInputListeners();
export const addServiceTypeListener = () =>
  formService.addServiceTypeListener();
export const cancelPendingAutoSave = () => formService.cancelPendingAutoSave();
export const addDoneBehavior = () => formService.addDoneBehavior();
export const gatherAllData = () => formService.gatherAllData();
export const getInitialFormDataStr = () => formService.getInitialFormDataStr();
export const hasPendingChanges = () => formService.hasPendingChanges();
