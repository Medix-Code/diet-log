/**
 * @file dietService.js
 * @description Lògica de negoci per a la gestió de dietes: desar, carregar,
 *              actualitzar, eliminar i validar abans de les operacions.
 * @module dietService
 */

// Importacions del Repositori (Base de Dades)

import { setModeForService } from "./servicesPanelManager.js";

import {
  addDiet,
  getAllDiets,
  getDiet,
  deleteDietById,
  updateDiet,
} from "../db/indexedDbDietRepository.js";

// Importacions de UI (Notificacions, Modals, Pestanyes)
import { showToast } from "../ui/toast.js";
import {
  showConfirmModal,
  closeDietModal,
  displayDietOptions,
} from "../ui/modals.js";
import { getCurrentTab } from "../ui/tabs.js";

// Importacions de Serveis (Formulari, Signatures)
import {
  gatherAllData,
  captureInitialFormState, // Canviat nom per claredat
  removeErrorClassesFromService, // <-- NOM CORREGIT DE L'IMPORT
} from "./formService.js";
import {
  setSignatureConductor,
  setSignatureAjudant,
  updateSignatureIcons,
} from "./signatureService.js";

// Importacions d'Utilitats (Validació, Format)
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
  EMPRESA_SELECT: "empresa",
};
const SERVICE_CONTAINER_SELECTOR = ".service"; // Classe per a cada contenidor de servei
const SERVICE_FIELD_SELECTORS = {
  // Reutilitzem la definició de formService si és possible o la definim aquí
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

// --- Funcions Privades ---

/**
 * Construeix l'objecte Dieta normalitzat per a l'emmagatzematge.
 * @param {object} generalData - Dades generals del formulari.
 * @param {object[]} servicesData - Array de dades dels serveis.
 * @param {string} dietId - L'ID calculat per a la dieta.
 * @returns {object} Objecte Dieta llest per a IndexedDB.
 */
function buildDietObject(generalData, servicesData, dietId) {
  // Validació bàsica d'entrada
  if (!generalData || !Array.isArray(servicesData) || !dietId) {
    throw new Error("Dades incompletes per construir Dieta.");
  }

  return {
    id: dietId, // ID calculat (ex: primers 9 dígits servei 1)
    date: generalData.date || "",
    dietType: generalData.dietType || "",
    vehicleNumber: generalData.vehicleNumber || "",
    person1: generalData.person1 || "",
    person2: generalData.person2 || "",
    empresa: generalData.empresa || "",
    signatureConductor: generalData.signatureConductor || "", // Ja ve de signatureService
    signatureAjudant: generalData.signatureAjudant || "", // Ja ve de signatureService
    services: servicesData.map((s) => ({
      // Assegura que tots els camps existeixen
      serviceNumber: s.serviceNumber || "",
      origin: s.origin || "",
      originTime: s.originTime || "",
      destination: s.destination || "",
      destinationTime: s.destinationTime || "",
      endTime: s.endTime || "",
      mode: s.mode || "3.6",
    })),
    timeStampDiet: new Date().toISOString(), // Timestamp de l'operació
  };
}

/**
 * Valida les pestanyes del formulari i mostra feedback a l'usuari si hi ha errors.
 * @returns {boolean} True si totes les validacions passen, False altrament.
 */
function validateFormTabs() {
  const dadesTabElement = document.getElementById(DOM_IDS.DADES_TAB);
  const serveisTabElement = document.getElementById(DOM_IDS.SERVEIS_TAB);

  // Neteja errors previs
  dadesTabElement?.classList.remove(CSS_CLASSES.ERROR_TAB);
  serveisTabElement?.classList.remove(CSS_CLASSES.ERROR_TAB);

  const isDadesValid = validateDadesTab();
  const isServeisValid = validateServeisTab();

  if (isDadesValid && isServeisValid) {
    return true; // Tot correcte
  }

  // Gestiona la UI d'errors
  const currentTab = getCurrentTab();
  let errorMessage = "";

  if (!isDadesValid && !isServeisValid) {
    errorMessage = "Completa los campos obligatorios en Datos y Servicios.";
    dadesTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
    serveisTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else if (!isDadesValid) {
    errorMessage = "Completa los campos obligatorios en la pestaña Datos.";
    dadesTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else {
    // Només !isServeisValid
    errorMessage = "Completa los campos obligatorios en la pestaña Servicios.";
    serveisTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  }

  showToast(errorMessage, "error");

  // Opcional: Navegar a la primera pestanya amb error?
  // if (!isDadesValid && currentTab !== 'dades') {
  //     navigateToTab('dades'); // Necessitaria una funció per canviar de tab
  // } else if (!isServeisValid && currentTab !== 'serveis') {
  //     navigateToTab('serveis');
  // }

  return false; // Hi ha errors
}

/**
 * Omple els camps del formulari amb les dades d'una dieta carregada.
 * @param {object} diet - L'objecte Dieta recuperat d'IndexedDB.
 */
function populateFormWithDietData(diet) {
  // Camps generals
  document.getElementById(DOM_IDS.DATE_INPUT).value = diet.date || "";
  document.getElementById(DOM_IDS.DIET_TYPE_SELECT).value = diet.dietType || "";
  document.getElementById(DOM_IDS.VEHICLE_INPUT).value =
    diet.vehicleNumber || "";
  document.getElementById(DOM_IDS.PERSON1_INPUT).value = diet.person1 || "";
  document.getElementById(DOM_IDS.PERSON2_INPUT).value = diet.person2 || "";
  document.getElementById(DOM_IDS.EMPRESA_SELECT).value = diet.empresa || "";

  // Firmes (usant el servei corresponent)
  setSignatureConductor(diet.signatureConductor || "");
  setSignatureAjudant(diet.signatureAjudant || "");
  // updateSignatureIcons(); // setSignature... ja ho fan internament ara

  // Serveis
  const serviceElements = document.querySelectorAll(SERVICE_CONTAINER_SELECTOR);
  diet.services.forEach((serviceData, index) => {
    const serviceElement = serviceElements[index];
    if (serviceElement) {
      // Omple cada camp del servei
      for (const [fieldName, selector] of Object.entries(
        SERVICE_FIELD_SELECTORS
      )) {
        const inputElement = serviceElement.querySelector(selector);
        if (inputElement) {
          inputElement.value = serviceData[fieldName] || "";
        }
      }
      console.log(`Servei ${index} carregat amb mode:`, serviceData.mode);
      // aplica el mode guardat (o 3.6)
      setModeForService(index, serviceData.mode || "3.6");

      // Neteja possibles errors visuals previs d'aquest servei
      removeErrorClassesFromService(serviceElement);
    }
  });

  // Podria ser necessari netejar serveis extra si el formulari en té més que la dieta carregada
  for (let i = diet.services.length; i < serviceElements.length; i++) {
    const serviceElement = serviceElements[i];
    for (const selector of Object.values(SERVICE_FIELD_SELECTORS)) {
      const inputElement = serviceElement.querySelector(selector);
      if (inputElement) {
        inputElement.value = ""; // Neteja el camp
      }
    }
    removeErrorClassesFromService(serviceElement);
    // Aquí també podríem voler eliminar visualment el servei si la UI ho permet
  }
  // Al final de populateFormWithDietData
  console.log(
    "Finalització de populateFormWithDietData, cap crida posterior hauria de canviar els modes."
  );
}

// --- Funcions Públiques / Exportades ---

/**
 * Gestiona el clic en el botó "Guardar Dieta".
 * Valida, comprova si existeix, demana confirmació si cal, i desa/actualitza.
 * @export
 */
export async function onClickSaveDiet() {
  if (!validateFormTabs()) {
    return; // Atura si la validació falla
  }

  try {
    const result = await handleSaveDietWithPossibleOverwrite();

    // Actualitza l'estat inicial només si s'ha desat o sobreescrit
    if (result === "saved" || result === "overwritten") {
      captureInitialFormState(); // Captura el nou estat com a inicial
      showToast("Dieta guardada correctamente.", "success");
    } else if (result === "unchanged") {
      showToast("No hay cambios para guardar.", "info");
    } else {
      console.log("Operació de desat cancel·lada per l'usuari o error.");
      // No mostrem toast si l'usuari cancel·la la sobreescriptura
    }
  } catch (error) {
    console.error("Error durant onClickSaveDiet:", error);
    showToast(`Error al guardar la dieta: ${error.message}`, "error");
  }
}

/**
 * Lògica principal per desar o actualitzar una dieta, gestionant sobreescriptures.
 * @returns {Promise<'saved'|'overwritten'|'unchanged'|null>} Estat de l'operació o null si es cancel·la.
 * @throws {Error} Si hi ha un error durant l'accés a BD o la construcció de l'objecte.
 * @export
 */
export async function handleSaveDietWithPossibleOverwrite() {
  const formData = gatherAllData();
  if (!formData)
    throw new Error("No s'han pogut recollir les dades del formulari.");
  const { generalData, servicesData } = formData;

  // Calcula l'ID (assegura't que hi hagi almenys un servei amb número)
  const firstServiceNumber = servicesData[0]?.serviceNumber?.trim();
  if (!firstServiceNumber || firstServiceNumber.length < 9) {
    // Considera com gestionar aquest cas: error, ID per defecte, etc.
    showToast(
      "El número del primer servicio es necesario para identificar la dieta.",
      "warning"
    );
    throw new Error(
      "ID de dieta no vàlid (requereix número del primer servei)."
    );
  }
  const dietId = firstServiceNumber.slice(0, 9);

  const dietToSave = buildDietObject(generalData, servicesData, dietId);

  // Comprova si ja existeix
  const existingDiet = await getDiet(dietId); // Més eficient que getAllDiets()

  if (existingDiet) {
    // Compara les dades (excloent el timestamp)
    const cleanExisting = { ...existingDiet };
    delete cleanExisting.timeStampDiet;
    const cleanToSave = { ...dietToSave };
    delete cleanToSave.timeStampDiet;

    if (JSON.stringify(cleanExisting) === JSON.stringify(cleanToSave)) {
      console.log("Les dades de la dieta no han canviat.");
      return "unchanged"; // No hi ha canvis reals
    } else {
      // Demana confirmació per sobreescriure
      const confirmTitle = "Sobrescribir dieta";
      const confirmMessage = `Ya existe una dieta con el número de servicio ${dietId}. ¿Quieres sobrescribirla con los datos actuales?`;
      const confirmed = await showConfirmModal(confirmMessage, confirmTitle);

      if (confirmed) {
        await updateDiet(dietToSave); // Actualitza a la BD
        console.log(`Dieta ${dietId} sobreescrita.`);
        return "overwritten";
      } else {
        return null; // L'usuari ha cancel·lat
      }
    }
  } else {
    // No existeix, afegeix-la com a nova
    await addDiet(dietToSave);
    console.log(`Dieta ${dietId} desada com a nova.`);
    return "saved";
  }
}

/**
 * Carrega les dades d'una dieta específica al formulari.
 * @param {string} dietId - L'ID de la dieta a carregar.
 * @export
 * @throws {Error} Si no es troba la dieta o hi ha un error durant la càrrega/populació.
 */
export async function loadDietById(dietId) {
  if (!dietId) {
    console.warn("S'ha intentat carregar una dieta sense ID.");
    throw new Error("ID de dieta no proporcionat."); // Llança error per indicar problema
  }
  try {
    const diet = await getDiet(dietId); // Obté la dieta
    if (!diet) {
      showToast(`No se encontró la dieta con ID ${dietId}.`, "error");
      throw new Error(`Dieta amb ID ${dietId} no trobada.`); // Llança error
    }

    populateFormWithDietData(diet); // Omple el formulari

    captureInitialFormState(); // Captura com a estat inicial

    showToast("Dieta cargada correctamente.", "success");
    console.log("Intentant tancar el modal de dietes...");
    // *** PUNT CLAU: Tanca el modal DESPRÉS que tot hagi anat bé ***
    closeDietModal(); // Crida a la funció importada de modals.jsç
    console.log("Crida a closeDietModal realitzada.");
  } catch (error) {
    console.error(`Error carregant la dieta ${dietId}:`, error);
    showToast(
      `Error al cargar la dieta: ${error.message || "Error desconegut"}`,
      "error"
    );
    // Llança l'error perquè qui l'ha cridat (modals.js) sàpiga que ha fallat
    throw error;
  }
}

/**
 * Gestiona el procés d'eliminació d'una dieta, demanant confirmació prèvia.
 * @param {string} id - ID de la dieta a eliminar.
 * @param {string} dietDate - Data de la dieta (per al missatge).
 * @param {string} dietType - Tipus de la dieta (per al missatge).
 * @export
 */
export async function deleteDietHandler(id, dietDate, dietType) {
  if (!id) return;

  const { ddmmaa, franjaText } = getDietDisplayInfo(dietDate, dietType);
  const confirmTitle = "Eliminar dieta";
  const confirmMessage = `¿Confirmas que quieres eliminar permanentemente la dieta de la ${franjaText} del ${ddmmaa}?`;

  const confirmed = await showConfirmModal(confirmMessage, confirmTitle);

  if (confirmed) {
    try {
      await deleteDietById(id);
      showToast("Dieta eliminada correctamente.", "warning");
      // Actualitza la llista de dietes al modal (si està obert)
      await displayDietOptions(); // Recarrega les opcions

      // Comprova si queden dietes després d'eliminar
      const remainingDiets = await getAllDiets();
      if (remainingDiets.length === 0) {
        closeDietModal(); // Tanca el modal si ja no hi ha dietes per mostrar
      }
    } catch (error) {
      console.error(`Error eliminant la dieta ${id}:`, error);
      showToast(`Error al eliminar la dieta: ${error.message}`, "error");
    }
  }
}

// Helper: amaga/mostra camps `destination` i `destinationTime` d’un servei
function applyModeToServiceElement(svcEl, mode) {
  const hide = mode === "3.11" || mode === "3.22";
  svcEl
    .querySelectorAll(".destination-group, .destination-time-group")
    .forEach((n) => n.classList.toggle("hidden", hide));
}
