/**
 * @file dotacion.js
 * @description Gestiona el desat, càrrega i eliminació de dotacions (combinacions
 *              de vehicle, conductor, ajudant i les seves signatures) usant localStorage.
 * @module dotacionService
 */

import {
  getSignatureConductor,
  getSignatureAjudant,
  setSignatureConductor,
  setSignatureAjudant,
  // updateSignatureIcons ja no cal importar-la si setSignature* l'actualitzen
} from "./signatureService.js";
import { showToast } from "../ui/toast.js";

// --- Constants ---
const LS_KEY = "dotacions_v2"; // Clau per a localStorage (versionada per si canvia format)
const DOM_IDS = {
  MODAL: "dotacio-modal",
  OPTIONS_CONTAINER: "dotacio-options",
  TEMPLATE: "dotacio-template",
  NO_DOTACIO_TEXT: "no-dotacio-text",
  ADD_BTN: "add-dotacio",
  OPEN_MODAL_BTN: "open-dotacio-modal",
  CLOSE_MODAL_BTN: "close-dotacio-modal",
  VEHICLE_INPUT: "vehicle-number",
  PERSON1_INPUT: "person1",
  PERSON2_INPUT: "person2",
};
const CSS_CLASSES = {
  MODAL_OPEN: "modal-open",
  INPUT_ERROR: "input-error", // Classe per a inputs/grups amb error
  HIDDEN: "hidden",
};
const SELECTORS = {
  PERSON_INPUT_GROUP: ".input-with-icon", // Selector del contenidor de person1/person2
  DOTACIO_INFO: ".dotacio-info",
  LOAD_BTN: ".dotacio-load",
  DELETE_BTN: ".dotacio-delete",
};
const DATA_ATTRIBUTES = {
  INDEX: "data-index", // Atribut per guardar l'índex als botons del modal
};

// --- Variables d'Estat del Mòdul ---
let savedDotacions = []; // Array d'objectes { numero, conductor, ajudant, firmaConductor, firmaAjudant }
let dotacioModalElement = null;
let optionsContainerElement = null;
let dotacioTemplateElement = null;
let noDotacioTextElement = null;
let isInitialized = false;

// --- Funcions Privades (Prefixades amb _) ---

/** Carrega les dotacions des de localStorage amb gestió d'errors. */
function _loadDotacionsFromStorage() {
  try {
    const savedJson = localStorage.getItem(LS_KEY);
    savedDotacions = savedJson ? JSON.parse(savedJson) : [];
    if (!Array.isArray(savedDotacions)) {
      // Comprovació extra
      console.warn(
        "Les dades de dotacions a localStorage no eren un array vàlid. Reiniciant."
      );
      savedDotacions = [];
    }
  } catch (error) {
    console.error("Error carregant les dotacions des de localStorage:", error);
    savedDotacions = []; // Reseteja en cas d'error de parseig
    // Opcionalment, notificar l'usuari
    // showToast("Error al carregar les dotacions desades.", "error");
  }
}

/** Desa l'array actual de dotacions a localStorage. */
function _saveDotacionsToStorage() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(savedDotacions));
  } catch (error) {
    console.error("Error desant les dotacions a localStorage:", error);
    showToast("No s'han pogut desar les dotacions.", "error");
  }
}

/** Valida els camps necessaris del formulari principal per desar una dotació. */
function _validateDotacionInputs() {
  const vehicleInput = document.getElementById(DOM_IDS.VEHICLE_INPUT);
  const conductorInput = document.getElementById(DOM_IDS.PERSON1_INPUT);
  const ajudantInput = document.getElementById(DOM_IDS.PERSON2_INPUT);
  const conductorGroup = conductorInput?.closest(SELECTORS.PERSON_INPUT_GROUP);
  const ajudantGroup = ajudantInput?.closest(SELECTORS.PERSON_INPUT_GROUP);

  // Neteja errors visuals previs
  vehicleInput?.classList.remove(CSS_CLASSES.INPUT_ERROR);
  conductorGroup?.classList.remove(CSS_CLASSES.INPUT_ERROR);
  ajudantGroup?.classList.remove(CSS_CLASSES.INPUT_ERROR);

  const values = {
    vehiculo: vehicleInput?.value.trim() || "",
    conductor: conductorInput?.value.trim() || "",
    ajudant: ajudantInput?.value.trim() || "",
  };

  const errors = [];
  // 1. Comprova si el vehicle està omplert (obligatori)
  if (!values.vehiculo) {
    vehicleInput?.classList.add(CSS_CLASSES.INPUT_ERROR);
    errors.push("Vehículo");
  }

  // 2. Comprova si ALMENYS un entre Conductor o Ajudant està omplert
  if (!values.conductor && !values.ajudant) {
    // Si TOTS DOS estan buits, marca els dos com a error
    conductorGroup?.classList.add(CSS_CLASSES.INPUT_ERROR);
    ajudantGroup?.classList.add(CSS_CLASSES.INPUT_ERROR);
    // Afegim un missatge d'error genèric per a aquesta condició
    errors.push("Conductor o Ayudante");
  }

  if (errors.length > 0) {
    showToast(`Faltan campos obligatorios: ${errors.join(", ")}.`, "error");
    return null; // Indica validació fallida
  }

  return values; // Retorna valors nets si és vàlid
}

/** Busca l'índex d'una dotació existent (ignorant majúscules/minúscules). */
function _findExistingDotacioIndex(vehiculo, conductor, ajudant) {
  const vLower = vehiculo.toLowerCase();
  const cLower = conductor.toLowerCase();
  const aLower = ajudant.toLowerCase();
  return savedDotacions.findIndex(
    (d) =>
      d.numero.toLowerCase() === vLower &&
      d.conductor.toLowerCase() === cLower &&
      d.ajudant.toLowerCase() === aLower
  );
}

/** Abre el modal de gestión de dotaciones. */
function _openDotacioModal() {
  if (!dotacioModalElement) return;
  dotacioModalElement.style.display = "block";
  document.body.classList.add(CSS_CLASSES.MODAL_OPEN);
  _displayDotacioOptions(); // Actualitza la llista cada vegada que s'obre
  // TODO: Gestionar focus dins del modal
}

/** Cierra el modal de gestión de dotaciones. */
function _closeDotacioModal() {
  if (!dotacioModalElement) return;
  dotacioModalElement.style.display = "none";
  document.body.classList.remove(CSS_CLASSES.MODAL_OPEN);
  // TODO: Retornar focus al botó que el va obrir
  document.getElementById(DOM_IDS.OPEN_MODAL_BTN)?.focus();
}

/** Actualiza la lista de dotaciones mostrada en el modal. */
function _displayDotacioOptions() {
  if (!optionsContainerElement || !dotacioTemplateElement) return;

  optionsContainerElement.innerHTML = ""; // Neteja el contenidor

  if (savedDotacions.length === 0) {
    noDotacioTextElement?.classList.remove(CSS_CLASSES.HIDDEN);
  } else {
    noDotacioTextElement?.classList.add(CSS_CLASSES.HIDDEN);
    savedDotacions.forEach((dotacio, index) => {
      const clone = dotacioTemplateElement.content.cloneNode(true);
      const infoSpan = clone.querySelector(SELECTORS.DOTACIO_INFO);
      const loadBtn = clone.querySelector(SELECTORS.LOAD_BTN);
      const deleteBtn = clone.querySelector(SELECTORS.DELETE_BTN);

      if (infoSpan) infoSpan.textContent = _formatDotacioListText(dotacio);
      if (loadBtn) loadBtn.setAttribute(DATA_ATTRIBUTES.INDEX, index);
      if (deleteBtn) deleteBtn.setAttribute(DATA_ATTRIBUTES.INDEX, index);

      optionsContainerElement.appendChild(clone);
    });
  }
}

/** Formatea el texto para mostrar una dotación en la lista. */
function _formatDotacioListText(dotacio) {
  const unitat = dotacio.numero || "S/N";
  const cShort = _shortNameAndSurname(dotacio.conductor);
  const aShort = _shortNameAndSurname(dotacio.ajudant);
  return `${unitat} - ${cShort} / ${aShort}`; // Format una mica més clar
}

/** Acorta un nombre completo a Nombre + Primer Apellido. */
function _shortNameAndSurname(fullName) {
  if (!fullName || typeof fullName !== "string") return "S/D"; // Sense Dada
  const parts = fullName.trim().split(/\s+/); // Divideix per espais múltiples
  if (parts.length === 0) return "S/D";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1]}`; // Nom + Primer cognom
}

/** Carga los datos de una dotación seleccionada en el formulario principal. */
function _loadDotacio(index) {
  if (index < 0 || index >= savedDotacions.length) {
    console.warn(`Índex de dotació invàlid per carregar: ${index}`);
    return;
  }
  const selected = savedDotacions[index];

  // Neteja errors previs del formulari abans de carregar
  _clearDotacionInputErrors();

  // Carrega valors
  document.getElementById(DOM_IDS.VEHICLE_INPUT).value = selected.numero || "";
  document.getElementById(DOM_IDS.PERSON1_INPUT).value =
    selected.conductor || "";
  document.getElementById(DOM_IDS.PERSON2_INPUT).value = selected.ajudant || "";

  // Actualitza signatures (setSignature* ja actualitza la UI)
  setSignatureConductor(selected.firmaConductor || "");
  setSignatureAjudant(selected.firmaAjudant || "");

  showToast(`Dotació ${selected.numero} carregada.`, "success");
  _closeDotacioModal();
}

/** Elimina una dotación del array y actualiza el almacenamiento y la UI. */
function _deleteDotacio(index) {
  if (index < 0 || index >= savedDotacions.length) {
    console.warn(`Índex de dotació invàlid per eliminar: ${index}`);
    return;
  }
  const deletedDotacio = savedDotacions.splice(index, 1)[0]; // Elimina i obté l'eliminat
  _saveDotacionsToStorage();
  showToast(
    `Dotació ${_formatDotacioListText(deletedDotacio)} eliminada.`,
    "warning"
  );
  _displayDotacioOptions(); // Actualitza la llista al modal
}

/** Gestiona els clics dins del contenidor d'opcions (delegació). */
function _handleOptionsClick(event) {
  const target = event.target;
  const loadButton = target.closest(SELECTORS.LOAD_BTN);
  const deleteButton = target.closest(SELECTORS.DELETE_BTN);

  if (loadButton) {
    event.stopPropagation(); // Evita que altres listeners reaccionin
    const index = parseInt(loadButton.getAttribute(DATA_ATTRIBUTES.INDEX), 10);
    if (!isNaN(index)) _loadDotacio(index);
  } else if (deleteButton) {
    event.stopPropagation();
    const index = parseInt(
      deleteButton.getAttribute(DATA_ATTRIBUTES.INDEX),
      10
    );
    if (!isNaN(index)) {
      // Opcional: Demanar confirmació abans d'esborrar
      // const confirmed = await showConfirmModal("Segur que vols eliminar aquesta dotació?");
      // if (confirmed) _deleteDotacio(index);
      _deleteDotacio(index); // Elimina directament per ara
    }
  }
}

// --- Funcions Públiques / Exportades ---

/**
 * Inicialitza el servei de dotacions: carrega dades, configura listeners.
 * @export
 */
export function initDotacion() {
  if (isInitialized) return;

  // Cacheig d'elements DOM
  dotacioModalElement = document.getElementById(DOM_IDS.MODAL);
  optionsContainerElement = document.getElementById(DOM_IDS.OPTIONS_CONTAINER);
  dotacioTemplateElement = document.getElementById(DOM_IDS.TEMPLATE);
  noDotacioTextElement = document.getElementById(DOM_IDS.NO_DOTACIO_TEXT);
  const addDotacioBtn = document.getElementById(DOM_IDS.ADD_BTN);
  const openDotacioBtn = document.getElementById(DOM_IDS.OPEN_MODAL_BTN);
  const closeDotacioBtn = document.getElementById(DOM_IDS.CLOSE_MODAL_BTN);

  // Comprovació d'elements essencials
  if (
    !dotacioModalElement ||
    !optionsContainerElement ||
    !dotacioTemplateElement ||
    !addDotacioBtn ||
    !openDotacioBtn ||
    !closeDotacioBtn
  ) {
    console.warn(
      "Dotacion Service: Falten elements DOM essencials. Funcionalitat limitada."
    );
    return;
  }

  _loadDotacionsFromStorage();

  // Listeners botons principals
  addDotacioBtn.addEventListener("click", addDotacioFromMainForm);
  openDotacioBtn.addEventListener("click", _openDotacioModal);
  closeDotacioBtn.addEventListener("click", _closeDotacioModal);

  // Listener per tancar modal clicant fora (al fons)
  dotacioModalElement.addEventListener("click", (event) => {
    if (event.target === dotacioModalElement) {
      _closeDotacioModal();
    }
  });

  // Listener per tancar amb 'Escape'
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      dotacioModalElement.style.display === "block"
    ) {
      _closeDotacioModal();
    }
  });

  // Listener per delegació dins del modal
  optionsContainerElement.addEventListener("click", _handleOptionsClick);

  // Configura listeners per netejar errors als inputs principals
  const inputsToWatch = [
    DOM_IDS.VEHICLE_INPUT,
    DOM_IDS.PERSON1_INPUT,
    DOM_IDS.PERSON2_INPUT,
  ];
  inputsToWatch.forEach((inputId) => {
    const input = document.getElementById(inputId);
    input?.addEventListener("input", () => {
      const group = input.closest(SELECTORS.PERSON_INPUT_GROUP);
      if (group) {
        group.classList.remove(CSS_CLASSES.INPUT_ERROR);
      } else {
        input.classList.remove(CSS_CLASSES.INPUT_ERROR);
      }
    });
  });

  isInitialized = true;
  console.log("Dotacion Service inicialitzat.");
  // No cal cridar _displayDotacioOptions aquí, es fa quan s'obre el modal
}

/**
 * Gestiona el desat d'una dotació des del formulari principal.
 * Valida, comprova existència, desa/sobrescriu i actualitza UI.
 * (Abans era una funció interna, ara és més explícita).
 * @export // Exportem si es vol cridar des d'un altre lloc, sinó pot ser interna
 */
export function addDotacioFromMainForm() {
  const validatedValues = _validateDotacionInputs();
  if (!validatedValues) return; // La validació ha fallat (ja s'ha mostrat toast)

  const { vehiculo, conductor, ajudant } = validatedValues;
  const firmaConductor = getSignatureConductor(); // Obté signatures actuals
  const firmaAjudant = getSignatureAjudant();

  const existingIndex = _findExistingDotacioIndex(vehiculo, conductor, ajudant);

  const newDotacioData = {
    numero: vehiculo,
    conductor: conductor,
    ajudant: ajudant,
    firmaConductor: firmaConductor,
    firmaAjudant: firmaAjudant,
  };

  if (existingIndex !== -1) {
    // Sobresriu
    savedDotacions[existingIndex] = newDotacioData;
    showToast(`Dotació ${vehiculo} actualitzada.`, "success");
  } else {
    // Afegeix nova
    savedDotacions.push(newDotacioData);
    showToast(`Nova dotació ${vehiculo} desada.`, "success");
  }

  _saveDotacionsToStorage();
  // No cal actualitzar la llista del modal aquí, es farà quan s'obri
  // _displayDotacioOptions();
}

function _clearDotacionInputErrors() {
  const vehicleInput = document.getElementById(DOM_IDS.VEHICLE_INPUT);
  const conductorInput = document.getElementById(DOM_IDS.PERSON1_INPUT);
  const ajudantInput = document.getElementById(DOM_IDS.PERSON2_INPUT);

  const conductorGroup = conductorInput?.closest(SELECTORS.PERSON_INPUT_GROUP);
  const ajudantGroup = ajudantInput?.closest(SELECTORS.PERSON_INPUT_GROUP);

  vehicleInput?.classList.remove(CSS_CLASSES.INPUT_ERROR);
  conductorGroup?.classList.remove(CSS_CLASSES.INPUT_ERROR);
  ajudantGroup?.classList.remove(CSS_CLASSES.INPUT_ERROR);
}
