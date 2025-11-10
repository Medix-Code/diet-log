// Servei per gestionar dietes: guardar, carregar, validar

// Import/export directe per compatibilitat amb tests CommonJS
import { Diet } from "../models/diet.js";
export { Diet };

import { pseudoId } from "../utils/pseudoId.js";
import { timeAgo } from "../utils/relativeTime.js";
import { logger } from "../utils/logger.js";

// Encriptació transparent
import {
  isEncrypted,
  encryptDiet,
  decryptDiet,
} from "../utils/cryptoManager.js";
import { getMasterKey, isKeySystemInitialized } from "../utils/keyManager.js";

import {
  addDiet,
  getAllDiets,
  getDiet,
  deleteDietById,
  updateDiet,
  moveDietToTrash,
} from "../db/indexedDbDietRepository.js";
import {
  setModeForService,
  serviceNotes,
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
import {
  validateDadesTab,
  validateServeisTab,
  sanitizeText,
  isValidTimeFormat,
} from "../utils/validation.js";
import {
  setSignatureConductor,
  setSignatureAjudant,
} from "./signatureService.js";

// --- Constants ---
import {
  DOM_IDS,
  CSS_CLASSES,
  SERVICE_CONTAINER_SELECTOR,
  SERVICE_FIELD_SELECTORS,
} from "../config/constants.js";

// Variables per controlar el guardat amb mutex
let ongoingSave = Promise.resolve();
let isSaving = false;
let shouldReplaySave = false;
let pendingManualRequest = false;
const log = logger.withScope("DietService");

async function buildDietObject(generalData, servicesData, dietId) {
  // Validacions bàsiques
  if (!generalData || !Array.isArray(servicesData) || !dietId) {
    throw new Error("Datos incompletos para construir la dieta.");
  }
  if (!/^\d{9}$/.test(dietId)) {
    throw new Error("ID de dieta inválido. Debe contener 9 dígitos.");
  }
  for (const s of servicesData) {
    if (
      !isValidTimeFormat(s.originTime) ||
      !isValidTimeFormat(s.destinationTime) ||
      !isValidTimeFormat(s.endTime)
    ) {
      throw new Error("Formato de hora inválido detectado. Use HH:mm.");
    }
  }

  // Pseudonimització de l'ID
  const hashedDietId = await pseudoId(dietId);

  // Sempre actualitzar timestamp a ara
  const timeStampDiet = new Date().toISOString();

  // Construir objecte seguretat
  const dietData = {
    id: hashedDietId,
    date: sanitizeText(generalData.date),
    dietType: sanitizeText(generalData.dietType),
    vehicleNumber: sanitizeText(generalData.vehicleNumber),
    person1: sanitizeText(generalData.person1),
    person2: sanitizeText(generalData.person2),
    signatureConductor: generalData.signatureConductor,
    signatureAjudant: generalData.signatureAjudant,
    services: servicesData.map((s) => ({
      serviceNumber: sanitizeText(s.serviceNumber),
      origin: sanitizeText(s.origin),
      destination: sanitizeText(s.destination),
      originTime: s.originTime,
      destinationTime: s.destinationTime,
      endTime: s.endTime,
      mode: sanitizeText(s.mode),
      notes: sanitizeText(s.notes) || "",
    })),
    serviceType: sanitizeText(generalData.serviceType),
    timeStampDiet,
  };

  return new Diet(dietData);
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
      // Salta selectors buits (com 'notes' que es gestiona per separat)
      if (!selector) return;

      const input = element.querySelector(selector);
      if (input) input.value = serviceData[field] || "";
    });

    setModeForService(index, serviceData.mode || "3.6");
    removeErrorClassesFromService(element);

    serviceNotes[index] = serviceData.notes || "";
  });

  // Neteja serveis excedents
  for (let i = diet.services.length; i < serviceElements.length; i++) {
    const element = serviceElements[i];
    if (!element) continue;
    Object.values(SERVICE_FIELD_SELECTORS).forEach((selector) => {
      // Salta selectors buits
      if (!selector) return;

      const input = element.querySelector(selector);
      if (input) input.value = "";
    });
    removeErrorClassesFromService(element);

    serviceNotes[i] = "";
  }
}

async function performSave(requestedManual) {
  pendingManualRequest = pendingManualRequest || requestedManual;

  if (isSaving) {
    shouldReplaySave = true;
    return ongoingSave;
  }

  isSaving = true;
  const isManual = pendingManualRequest;
  pendingManualRequest = false;

  const saveTask = (async () => {
    const { generalData, servicesData } = gatherAllData();
    const dietId = servicesData[0]?.serviceNumber?.slice(0, 9) || "";
    if (!dietId || !/^\d{9}$/.test(dietId)) {
      if (isManual) {
        showToast(
          "El primer servicio debe tener un N.º de servicio válido.",
          "error"
        );
      }
      return;
    }

    const hashedId = await pseudoId(dietId);
    const existingDiet = await getDiet(hashedId);
    const isNewDiet = !existingDiet;
    const saveMessage = isNewDiet ? "Guardando nueva dieta…" : "Guardando…";

    if (isManual) {
      indicateSaving(saveMessage);
    }

    setSaveButtonState(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!validateFormTabs()) {
        if (isManual) {
          indicateSaveError("Validación fallida");
        }
        return;
      }

      const dietToSave = await buildDietObject(
        generalData,
        servicesData,
        dietId
      );

      // 🔐 ENCRIPTACIÓ OBLIGATÒRIA (fail-closed): NO guardar si falla
      if (!(await isKeySystemInitialized())) {
        log.error(
          "❌ Sistema de claus no inicialitzat. NO es pot guardar la dieta."
        );
        const errorMsg =
          "Error de seguretat: Sistema d'encriptació no disponible. Proveu recarregar la pàgina.";
        showToast(errorMsg, "error", 5000);
        if (isManual) {
          indicateSaveError("Sistema d'encriptació no disponible");
        }
        return; // BLOQUEJAR el guardat
      }

      let finalDiet;
      try {
        const masterKey = await getMasterKey();
        finalDiet = await encryptDiet(dietToSave, masterKey);
        log.debug("🔒 Dieta encriptada abans de guardar");
      } catch (encryptError) {
        log.error("❌ Error CRÍTIC encriptant dieta:", encryptError);
        const errorMsg =
          "Error crític d'encriptació. Les dades NO s'han desat per seguretat.";
        showToast(errorMsg, "error", 5000);
        if (isManual) {
          indicateSaveError("Error d'encriptació");
        }
        return; // BLOQUEJAR el guardat si falla l'encriptació
      }

      if (existingDiet) {
        await updateDiet(finalDiet);
      } else {
        await addDiet(finalDiet);
      }

      lastSavedDate = new Date();
      renderLastSaved();

      if (isManual) {
        showToast("Dieta guardada correctament.", "success");
      }

      captureInitialFormState();
      indicateSaved();

      if (isManual) {
        await displayDietOptions();
      }
    } catch (error) {
      log.error("Error en performSave:", error);
      indicateSaveError(error.message || "No se pudo guardar");
      if (isManual) {
        showToast(`Error al guardar: ${error.message}`, "error");
      }
    } finally {
      setSaveButtonState(true);
    }
  })();

  ongoingSave = saveTask;

  try {
    await saveTask;
  } finally {
    isSaving = false;
    if (shouldReplaySave || pendingManualRequest) {
      const manualPending = pendingManualRequest;
      pendingManualRequest = false;
      shouldReplaySave = false;
      return performSave(manualPending);
    }
  }

  return ongoingSave;
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
/* ───────────── dietService.js ───────────── */
export async function loadDietById(dietId) {
  if (!dietId || typeof dietId !== "string") {
    throw new Error("ID invàlid");
  }

  // 1️⃣  Si ja ens arriba un hash (64 caràcters) el fem servir directament.
  //     Si és el número de 9 xifres, el convertim amb pseudoId().
  let diet =
    dietId.length === 64
      ? await getDiet(dietId) // ja és hash
      : await getDiet(await pseudoId(dietId)); // número → hash

  if (!diet) {
    throw new Error(`Dieta no trobada: ${dietId}`);
  }

  // 🔓 DESENCRIPTACIÓ TRANSPARENT: Desencriptar si està encriptada
  if (isEncrypted(diet)) {
    try {
      const masterKey = await getMasterKey();
      diet = await decryptDiet(diet, masterKey);
      log.debug("🔓 Dieta desencriptada correctament");
    } catch (decryptError) {
      log.error("Error desencriptant dieta:", decryptError);
      showToast("Error desencriptant dieta. Pot estar corrupta.", "error");
      throw decryptError;
    }
  }

  /* ---------- omplim el formulari ---------- */
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
    const diet = await getDiet(id);
    if (!diet) {
      showToast("Error: Dieta no trobada", "error");
      return;
    }

    // Moure a paperera
    await moveDietToTrash(diet);

    // Eliminar de la llista visual
    removeDietItemFromList(id);

    showToast("Dieta moguda a la paperera", "success", 3000);

    captureInitialFormState();
    resetDirty();
  } catch (error) {
    log.error("Error en deleteDietHandler:", error);
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
