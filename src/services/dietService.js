/**
 * @file dietService.js
 * @description Gestió de dietes amb validacions, guardat i càrrega.
 * @module dietService
 */

import { timeAgo } from "../utils/relativeTime.js";
import {
  addDiet,
  getAllDiets,
  getDiet,
  deleteDietById,
  updateDiet,
} from "../db/indexedDbDietRepository.js";
import {
  setModeForService,
  updateServicePanelsForServiceType,
  removeErrorClassesFromService,
} from "./servicesPanelManager.js";
import { showToast } from "../ui/toast.js";
import {
  restoreDietItemToList,
  closeDietModal,
  displayDietOptions,
  removeDietItemFromList,
} from "../ui/modals.js";
import {
  indicateSaving,
  indicateSaved,
  indicateSaveError,
  resetDirty,
} from "../ui/saveIndicator.js";
import {
  gatherAllData,
  captureInitialFormState,
  cancelPendingAutoSave,
  setSaveButtonState,
} from "./formService.js";
import { validateDadesTab, validateServeisTab } from "../utils/validation.js";
import { getDietDisplayInfo } from "../utils/utils.js";
import {
  setSignatureConductor,
  setSignatureAjudant,
} from "./signatureService.js";

// --- Constants ---
const DOM_IDS = {
  DADES_TAB: "tab-dades",
  SERVEIS_TAB: "tab-serveis",
  DATE_INPUT: "date",
  DIET_TYPE_SELECT: "diet-type",
  VEHICLE_INPUT: "vehicle-number",
  PERSON1_INPUT: "person1",
  PERSON2_INPUT: "person2",
  SERVICE_TYPE_SELECT: "service-type",
};

const CSS_CLASSES = {
  ERROR_TAB: "error-tab",
};

const SERVICE_CONTAINER_SELECTOR = ".service";

const SERVICE_FIELD_SELECTORS = {
  serviceNumber: ".service-number",
  origin: ".origin",
  originTime: ".origin-time",
  destination: ".destination",
  destinationTime: ".destination-time",
  endTime: ".end-time",
};

// --- Classe Diet ---
export class Diet {
  constructor({
    id = "",
    date = "",
    dietType = "",
    vehicleNumber = "",
    person1 = "",
    person2 = "",
    signatureConductor = "",
    signatureAjudant = "",
    services = [],
    serviceType = "TSU",
    timeStampDiet = new Date().toISOString(),
  } = {}) {
    this.id = String(id);
    this.date = String(date);
    this.dietType = String(dietType);
    this.vehicleNumber = String(vehicleNumber);
    this.person1 = String(person1);
    this.person2 = String(person2);
    this.signatureConductor = String(signatureConductor);
    this.signatureAjudant = String(signatureAjudant);
    this.services = Array.isArray(services) ? services : [];
    this.serviceType = String(serviceType);
    this.timeStampDiet = String(timeStampDiet);
  }
}

// --- Funcions Auxiliars ---

/**
 * Construeix un objecte Diet a partir de dades generals i serveis.
 * @param {Object} generalData - Dades generals del formulari.
 * @param {Array} servicesData - Array de dades de serveis.
 * @param {string} dietId - ID de la dieta.
 * @returns {Promise<Diet>} - Objecte Diet construït.
 */
async function buildDietObject(generalData, servicesData, dietId) {
  if (
    !generalData ||
    !Array.isArray(servicesData) ||
    servicesData.length === 0 ||
    !dietId
  ) {
    throw new Error("Dades incompletes.");
  }
  if (!/^\d{9}$/.test(dietId)) {
    throw new Error("ID invàlid.");
  }

  const existingDiet = await getDiet(dietId);
  const timeStampDiet = existingDiet
    ? existingDiet.timeStampDiet
    : new Date().toISOString();

  return new Diet({
    id: dietId,
    date: generalData.date || "",
    dietType: generalData.dietType || "",
    vehicleNumber: generalData.vehicleNumber || "",
    person1: generalData.person1 || "",
    person2: generalData.person2 || "",
    signatureConductor: generalData.signatureConductor || "",
    signatureAjudant: generalData.signatureAjudant || "",
    services: servicesData.map((s) => ({
      serviceNumber: s.serviceNumber || "",
      origin: s.origin || "",
      originTime: s.originTime || "",
      destination: s.destination || "",
      destinationTime: s.destinationTime || "",
      endTime: s.endTime || "",
      mode: s.mode || "3.6",
    })),
    serviceType: generalData.serviceType || "TSU",
    timeStampDiet,
  });
}

/**
 * Valida les pestanyes del formulari i gestiona errors UI.
 * @returns {boolean} - True si és vàlid, false altrament.
 */
function validateFormTabs() {
  const dadesTab = document.getElementById(DOM_IDS.DADES_TAB);
  const serveisTab = document.getElementById(DOM_IDS.SERVEIS_TAB);

  dadesTab?.classList.remove(CSS_CLASSES.ERROR_TAB);
  serveisTab?.classList.remove(CSS_CLASSES.ERROR_TAB);

  const isDadesValid = validateDadesTab();
  const isServeisValid = validateServeisTab();

  if (isDadesValid && isServeisValid) return true;

  let message = "";
  if (!isDadesValid && !isServeisValid) {
    message = "Completa los campos obligatorios en Datos y Servicios.";
    dadesTab?.classList.add(CSS_CLASSES.ERROR_TAB);
    serveisTab?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else if (!isDadesValid) {
    message = "Completa los campos obligatorios en la pestaña Datos.";
    dadesTab?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else {
    message = "Completa los campos obligatorios en la pestaña Servicios.";
    serveisTab?.classList.add(CSS_CLASSES.ERROR_TAB);
  }

  showToast(message, "error");
  return false;
}

/**
 * Omple el formulari amb dades d'una dieta.
 * @param {Diet} diet - Objecte Diet a carregar.
 */
function populateFormWithDietData(diet) {
  if (!diet) return;

  const getEl = (id) => document.getElementById(id);
  getEl(DOM_IDS.DATE_INPUT).value = diet.date || "";
  getEl(DOM_IDS.DIET_TYPE_SELECT).value = diet.dietType || "";
  getEl(DOM_IDS.VEHICLE_INPUT).value = diet.vehicleNumber || "";
  getEl(DOM_IDS.PERSON1_INPUT).value = diet.person1 || "";
  getEl(DOM_IDS.PERSON2_INPUT).value = diet.person2 || "";

  const serviceTypeSelect = getEl(DOM_IDS.SERVICE_TYPE_SELECT);
  if (serviceTypeSelect) {
    serviceTypeSelect.value = diet.serviceType || "TSU";
    updateServicePanelsForServiceType(serviceTypeSelect.value);
  }

  setSignatureConductor(diet.signatureConductor || "");
  setSignatureAjudant(diet.signatureAjudant || "");

  const serviceElements = document.querySelectorAll(SERVICE_CONTAINER_SELECTOR);
  diet.services.forEach((serviceData, index) => {
    const element = serviceElements[index];
    if (!element) return;

    Object.entries(SERVICE_FIELD_SELECTORS).forEach(([field, selector]) => {
      const input = element.querySelector(selector);
      if (input) input.value = serviceData[field] || "";
    });

    setModeForService(index, serviceData.mode || "3.6");
    removeErrorClassesFromService(element);
  });

  // Neteja serveis excedents
  for (let i = diet.services.length; i < serviceElements.length; i++) {
    const element = serviceElements[i];
    if (!element) continue;
    Object.values(SERVICE_FIELD_SELECTORS).forEach((selector) => {
      const input = element.querySelector(selector);
      if (input) input.value = "";
    });
    removeErrorClassesFromService(element);
  }
}

/**
 * Realitza el guardat de la dieta.
 * @param {boolean} isManual - Si és un guardat manual.
 */
async function performSave(isManual) {
  const { generalData, servicesData } = gatherAllData();
  const dietId = servicesData[0]?.serviceNumber?.slice(0, 9) || "";
  if (!dietId || !/^\d{9}$/.test(dietId)) {
    throw new Error("ID invàlid");
  }

  const existingDiet = await getDiet(dietId);
  const isNewDiet = !existingDiet;
  const saveMessage = isNewDiet ? "Guardando nueva dieta…" : "Guardando…";
  indicateSaving(saveMessage);

  setSaveButtonState(false);

  try {
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulació

    if (!validateFormTabs()) {
      throw new Error("Validació fallida");
    }

    const dietToSave = await buildDietObject(generalData, servicesData, dietId);

    if (existingDiet) {
      await updateDiet(dietToSave);
    } else {
      await addDiet(dietToSave);
      captureInitialFormState();
      resetDirty();
    }

    if (isManual) {
      showToast("Dieta guardada correctament.", "success");
    }

    lastSavedDate = new Date();
    renderLastSaved();

    captureInitialFormState();
    indicateSaved();

    await displayDietOptions();
  } catch (error) {
    indicateSaveError(error.message || "No se pudo guardar");
    if (isManual) {
      showToast(`Error al guardar: ${error.message}`, "error");
    }
    setSaveButtonState(true);
  }
}

// --- Funcions Exportades ---

/**
 * Gestiona el guardat manual de la dieta.
 */
export async function handleManualSave() {
  cancelPendingAutoSave();
  await performSave(true);
}

/**
 * Realitza un autoguardat de la dieta.
 */
export async function autoSaveDiet() {
  await performSave(false);
}

/**
 * Carrega una dieta per ID i omple el formulari.
 * @param {string} dietId - ID de la dieta.
 */
export async function loadDietById(dietId) {
  if (!dietId || typeof dietId !== "string") {
    throw new Error("ID invàlid");
  }

  const diet = await getDiet(dietId);
  if (!diet) {
    throw new Error(`Dieta no trobada: ${dietId}`);
  }

  populateFormWithDietData(diet);
  captureInitialFormState();

  if (diet.timeStampDiet) {
    lastSavedDate = new Date(diet.timeStampDiet);
    renderLastSaved();
  }

  showToast("Dieta cargada correctamente.", "success");
  closeDietModal();
}

export async function deleteDietHandler(id, dietDate, dietType) {
  if (!id) return;

  try {
    const dietBackup = await getDiet(id);
    if (!dietBackup) {
      showToast("Error: Dieta no trobada", "error");
      return;
    }

    // Millora: Recuperem totes les dietes i ordenem com a displayDietOptions per calcular l'índex visual correcte
    const allDiets = await getAllDiets();
    const sortedDiets = allDiets.sort(
      (a, b) => new Date(b.timeStampDiet) - new Date(a.timeStampDiet)
    );
    dietBackup.index = sortedDiets.findIndex((d) => d.id === id); // Ara l'índex coincideix amb la llista mostrada

    await deleteDietById(id);

    showToast("Dieta eliminada", "success", 5000, {
      undoCallback: async () => {
        await addDiet(dietBackup); // Restaura BD

        // Crida la funció exportada per restauració visual
        restoreDietItemToList(dietBackup);

        showToast("Dieta restaurada", "success");
      },
      onExpire: () => {
        removeDietItemFromList(id);
      },
    });

    captureInitialFormState();
    resetDirty();
  } catch (error) {
    console.error("Error en deleteDietHandler:", error);
    showToast("Error al eliminar la dieta", "error");
  }
}

let lastSavedDate = null;

/**
 * Renderitza l'últim guardat.
 */
export function renderLastSaved() {
  const element = document.getElementById("last-saved");
  if (!element) return;
  element.textContent = lastSavedDate ? timeAgo(lastSavedDate) : "";
}

setInterval(() => {
  if (lastSavedDate) renderLastSaved();
}, 60000);
