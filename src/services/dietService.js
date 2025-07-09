// ---------------------------------------------------------------------------
// dietService.js – lògica de persistència i flux de treball de la dieta
// ---------------------------------------------------------------------------

/**
 * @file dietService.js
 * @description Lògica de negoci per a la gestió de dietes: desar, carregar,
 *              actualitzar, eliminar i validar abans de les operacions.
 * @module dietService
 */

// ────────────────────────────────────────────────────────────
// Imports
// ────────────────────────────────────────────────────────────
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
  showConfirmModal,
  closeDietModal,
  displayDietOptions,
} from "../ui/modals.js";
import { getCurrentTab } from "../ui/tabs.js";
import {
  indicateSaving,
  indicateSaved,
  indicateSaveError,
} from "../ui/saveIndicator.js";
import {
  gatherAllData,
  captureInitialFormState,
  cancelPendingAutoSave,
  setSaveButtonState,
} from "./formService.js";
import {
  setSignatureConductor,
  setSignatureAjudant,
} from "./signatureService.js";
import { validateDadesTab, validateServeisTab } from "../utils/validation.js";
import { getDietDisplayInfo } from "../utils/utils.js";

// ────────────────────────────────────────────────────────────
// Constants i selectors DOM
// ────────────────────────────────────────────────────────────
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

const SERVICE_CONTAINER_SELECTOR = ".service";
const SERVICE_FIELD_SELECTORS = {
  serviceNumber: ".service-number",
  origin: ".origin",
  originTime: ".origin-time",
  destination: ".destination",
  destinationTime: ".destination-time",
  endTime: ".end-time",
};

const CSS_CLASSES = {
  ERROR_TAB: "error-tab",
};

// ────────────────────────────────────────────────────────────
// Helper – construcció d'una dieta normalitzada
// ────────────────────────────────────────────────────────────
function buildDietObject(generalData, servicesData, dietId) {
  if (!generalData || !Array.isArray(servicesData) || !dietId) {
    throw new Error("Dades incompletes per construir Dieta.");
  }

  return {
    id: dietId,
    date: generalData.date || "",
    dietType: generalData.dietType || "",
    vehicleNumber: generalData.vehicleNumber || "",
    person1: generalData.person1 || "",
    person2: generalData.person2 || "",
    serviceType: generalData.serviceType || "TSU",
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
    timeStampDiet: new Date().toISOString(),
  };
}

// ────────────────────────────────────────────────────────────
// Validació de pestanyes
// ────────────────────────────────────────────────────────────
function validateFormTabs() {
  const dadesTabElement = document.getElementById(DOM_IDS.DADES_TAB);
  const serveisTabElement = document.getElementById(DOM_IDS.SERVEIS_TAB);

  dadesTabElement?.classList.remove(CSS_CLASSES.ERROR_TAB);
  serveisTabElement?.classList.remove(CSS_CLASSES.ERROR_TAB);

  const isDadesValid = validateDadesTab();
  const isServeisValid = validateServeisTab();

  if (isDadesValid && isServeisValid) return true;

  let errorMessage;
  if (!isDadesValid && !isServeisValid) {
    errorMessage = "Completa los campos obligatorios en Datos y Servicios.";
    dadesTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
    serveisTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else if (!isDadesValid) {
    errorMessage = "Completa los campos obligatorios en la pestaña Datos.";
    dadesTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else {
    errorMessage = "Completa los campos obligatorios en la pestaña Servicios.";
    serveisTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  }

  showToast(errorMessage, "error");
  return false;
}

// ────────────────────────────────────────────────────────────
// Populate del formulari amb dades de la dieta
// ────────────────────────────────────────────────────────────
function populateFormWithDietData(diet) {
  // Dades generals
  document.getElementById(DOM_IDS.DATE_INPUT).value = diet.date || "";
  document.getElementById(DOM_IDS.DIET_TYPE_SELECT).value = diet.dietType || "";
  document.getElementById(DOM_IDS.VEHICLE_INPUT).value =
    diet.vehicleNumber || "";
  document.getElementById(DOM_IDS.PERSON1_INPUT).value = diet.person1 || "";
  document.getElementById(DOM_IDS.PERSON2_INPUT).value = diet.person2 || "";

  const serviceTypeSelect = document.getElementById(
    DOM_IDS.SERVICE_TYPE_SELECT
  );
  if (serviceTypeSelect) {
    serviceTypeSelect.value = diet.serviceType || "TSU";
    updateServicePanelsForServiceType(serviceTypeSelect.value);
  }

  setSignatureConductor(diet.signatureConductor || "");
  setSignatureAjudant(diet.signatureAjudant || "");

  // Serveis
  const serviceElements = document.querySelectorAll(SERVICE_CONTAINER_SELECTOR);
  diet.services.forEach((serviceData, idx) => {
    const el = serviceElements[idx];
    if (!el) return;

    Object.entries(SERVICE_FIELD_SELECTORS).forEach(([field, sel]) => {
      const input = el.querySelector(sel);
      if (input) input.value = serviceData[field] || "";
    });

    setModeForService(idx, serviceData.mode || "3.6");
    removeErrorClassesFromService(el);
  });

  // Neteja possibles serveis restants
  for (let i = diet.services.length; i < serviceElements.length; i++) {
    const el = serviceElements[i];
    Object.values(SERVICE_FIELD_SELECTORS).forEach((sel) => {
      const input = el.querySelector(sel);
      if (input) input.value = "";
    });
    removeErrorClassesFromService(el);
  }
}

// ────────────────────────────────────────────────────────────
// Gestió de guardat (manual i auto)
// ────────────────────────────────────────────────────────────
async function performSave(isManual) {
  indicateSaving();
  setSaveButtonState(false);

  try {
    await new Promise((r) => setTimeout(r, 500)); // micro delay UX

    if (!validateFormTabs())
      throw new Error("Validació de la pestanya Serveis fallida");

    const { generalData, servicesData } = gatherAllData();
    const dietId = servicesData[0]?.serviceNumber?.slice(0, 9);
    if (!dietId) throw new Error("ID de dieta no vàlid");

    const dietToSave = buildDietObject(generalData, servicesData, dietId);

    (await getDiet(dietId))
      ? await updateDiet(dietToSave)
      : await addDiet(dietToSave);

    if (isManual) showToast("Dieta guardada correctament.", "success");

    lastSavedDate = new Date();
    renderLastSaved();

    captureInitialFormState();
    indicateSaved();
  } catch (err) {
    console.error("[Save] ERROR:", err);
    indicateSaveError(err.message || "No se pudo guardar");
    if (isManual) showToast(`Error al guardar: ${err.message}`, "error");
    setSaveButtonState(true);
  }
}

export async function handleManualSave() {
  cancelPendingAutoSave();
  await performSave(true);
}

export async function autoSaveDiet() {
  await performSave(false);
}

// ────────────────────────────────────────────────────────────
// Carregar, eliminar, helpers
// ────────────────────────────────────────────────────────────
export async function loadDietById(dietId) {
  if (!dietId) throw new Error("ID de dieta no proporcionat");

  const diet = await getDiet(dietId);
  if (!diet) {
    showToast(`No se encontró la dieta con ID ${dietId}.`, "error");
    throw new Error(`Dieta amb ID ${dietId} no trobada.`);
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
  const { ddmmaa, franjaText } = getDietDisplayInfo(dietDate, dietType);
  const msg = `¿Confirmas que quieres eliminar permanentemente la dieta de la ${franjaText} del ${ddmmaa}?`;
  const confirmed = await showConfirmModal(msg, "Eliminar dieta");
  if (!confirmed) return;

  try {
    await deleteDietById(id);
    showToast("Dieta eliminada correctamente.", "warning");
    await displayDietOptions();

    const remaining = await getAllDiets();
    if (remaining.length === 0) closeDietModal();
  } catch (err) {
    console.error("Error eliminant la dieta", err);
    showToast(`Error al eliminar la dieta: ${err.message}`, "error");
  }
}

function applyModeToServiceElement(el, mode) {
  const hide = mode === "3.11" || mode === "3.22";
  el.querySelectorAll(".destination-group, .destination-time-group").forEach(
    (n) => n.classList.toggle("hidden", hide)
  );
}

// ────────────────────────────────────────────────────────────
// Bloc "Últim guardat"
// ────────────────────────────────────────────────────────────
let lastSavedDate = null;

export function renderLastSaved() {
  const el = document.getElementById("last-saved");
  if (!el) return;
  el.textContent = lastSavedDate ? timeAgo(lastSavedDate) : "";
}

setInterval(() => {
  if (lastSavedDate) renderLastSaved();
}, 60_000);
