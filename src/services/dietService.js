/**
 * @file dietService.js
 * @description Gestió de dietes.
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
  showConfirmModal,
  closeDietModal,
  displayDietOptions,
} from "../ui/modals.js";

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

// --- Classe Diet (mantenim com està, però exportada) ---
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

// --- Funcions ---

async function buildDietObject(generalData, servicesData, dietId) {
  // Feta async
  if (
    !generalData ||
    !Array.isArray(servicesData) ||
    servicesData.length === 0 ||
    !dietId
  )
    throw new Error("Dades incompletes.");
  if (!/^\d{9}$/.test(dietId)) throw new Error("ID invàlid.");

  const existingDiet = await getDiet(dietId); // Ara await funciona dins d'async
  const timeStampDiet = existingDiet
    ? existingDiet.timeStampDiet
    : new Date().toISOString(); // Manté l'original si existeix

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
    timeStampDiet: timeStampDiet, // Usa l'original o nou
  });
}

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

function populateFormWithDietData(diet) {
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

  for (let i = diet.services.length; i < serviceElements.length; i++) {
    const el = serviceElements[i];
    if (!el) continue;
    Object.values(SERVICE_FIELD_SELECTORS).forEach((sel) => {
      const input = el.querySelector(sel);
      if (input) input.value = "";
    });
    removeErrorClassesFromService(el);
  }
}

async function performSave(isManual) {
  indicateSaving();
  setSaveButtonState(false);

  try {
    await new Promise((r) => setTimeout(r, 500));

    if (!validateFormTabs()) throw new Error("Validació fallida");

    const { generalData, servicesData } = gatherAllData();
    const dietId = servicesData[0]?.serviceNumber?.slice(0, 9) || "";
    if (!dietId || !/^\d{9}$/.test(dietId)) throw new Error("ID invàlid");

    const dietToSave = await buildDietObject(generalData, servicesData, dietId); // Afegeix await aquí

    const existingDiet = await getDiet(dietId);
    if (existingDiet) await updateDiet(dietToSave);
    else await addDiet(dietToSave);

    if (isManual) showToast("Dieta guardada correctament.", "success");

    lastSavedDate = new Date();
    renderLastSaved();

    captureInitialFormState();
    indicateSaved();

    // Nou: Refresca la llista si el modal està obert
    const modal = document.getElementById(DOM_IDS.DIET_MODAL);
    if (modal && modal.style.display === "block") {
      await displayDietOptions(); // Crida per refrescar immediatament
    }

    // Depuració: Log per confirmar guardat
    console.log(
      "Dieta guardada amb ID:",
      dietId,
      "Timestamp:",
      dietToSave.timeStampDiet
    );
  } catch (err) {
    indicateSaveError(err.message || "No se pudo guardar");
    if (isManual) showToast(`Error al guardar: ${err.message}`, "error");
    setSaveButtonState(true);
    console.error("Error en guardat:", err);
  }
}

export async function handleManualSave() {
  cancelPendingAutoSave();
  await performSave(true);
}

export async function autoSaveDiet() {
  await performSave(false);
}

export async function loadDietById(dietId) {
  if (!dietId || typeof dietId !== "string") throw new Error("ID invàlid");

  const diet = await getDiet(dietId);
  if (!diet) throw new Error(`Dieta no trobada: ${dietId}`);

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

  await deleteDietById(id);
  showToast("Dieta eliminada correctamente.", "error");
  await displayDietOptions();

  const remaining = await getAllDiets();
  if (remaining.length === 0) closeDietModal();
}

function applyModeToServiceElement(el, mode) {
  const hide = mode === "3.11" || mode === "3.22";
  el.querySelectorAll(".destination-group, .destination-time-group").forEach(
    (n) => n.classList.toggle("hidden", hide)
  );
}

let lastSavedDate = null;

export function renderLastSaved() {
  const el = document.getElementById("last-saved");
  if (!el) return;
  el.textContent = lastSavedDate ? timeAgo(lastSavedDate) : "";
}

setInterval(() => {
  if (lastSavedDate) renderLastSaved();
}, 60000);
