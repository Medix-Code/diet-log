/**
 * @file dotacion.js
 * @description Gestiona dotaciones con localStorage.
 * @module dotacionService
 */
import { capitalizeWords } from "../utils/utils.js";
import { validateDotacioTab } from "../utils/validation.js";
import {
  initSwipeToDeleteDotacio,
  initMouseSwipeToDeleteDotacio,
  updateDotacioListVisibility,
  restoreDotacioItemToList,
} from "../ui/modals.js";
import {
  getSignatureConductor,
  getSignatureAjudant,
  setSignatureConductor,
  setSignatureAjudant,
} from "./signatureService.js";
import { showToast } from "../ui/toast.js";

// --- Constantes ---
const LS_KEY = "dotacions_v2";
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
  INPUT_ERROR: "input-error",
  HIDDEN: "hidden",
};
const SELECTORS = {
  PERSON_INPUT_GROUP: ".input-with-icon",
  DOTACIO_INFO: ".dotacio-info",
  LOAD_BTN: ".dotacio-load",
  DELETE_BTN: ".dotacio-delete",
};
const DATA_ATTRIBUTES = {
  INDEX: "data-index",
};
const MAX_TEXT_WIDTH = 180;

class DotacionService {
  constructor() {
    this.savedDotacions = [];
    this.dotacioModalElement = null;
    this.optionsContainerElement = null;
    this.dotacioTemplateElement = null;
    this.noDotacioTextElement = null;
    this.isInitialized = false;
  }

  /**
   * Inicializa el servicio.
   * @export
   */
  init() {
    if (this.isInitialized) return;

    this.dotacioModalElement = document.getElementById(DOM_IDS.MODAL);
    this.optionsContainerElement = document.getElementById(
      DOM_IDS.OPTIONS_CONTAINER
    );
    this.dotacioTemplateElement = document.getElementById(DOM_IDS.TEMPLATE);
    this.noDotacioTextElement = document.getElementById(
      DOM_IDS.NO_DOTACIO_TEXT
    );
    const addDotacioBtn = document.getElementById(DOM_IDS.ADD_BTN);
    const openDotacioBtn = document.getElementById(DOM_IDS.OPEN_MODAL_BTN);
    const closeDotacioBtn = document.getElementById(DOM_IDS.CLOSE_MODAL_BTN);

    if (
      !this.dotacioModalElement ||
      !this.optionsContainerElement ||
      !this.dotacioTemplateElement ||
      !addDotacioBtn ||
      !openDotacioBtn ||
      !closeDotacioBtn
    ) {
      return;
    }

    this.loadDotacionsFromStorage();

    addDotacioBtn.addEventListener(
      "click",
      this.addDotacioFromMainForm.bind(this)
    );
    openDotacioBtn.addEventListener("click", this.openDotacioModal.bind(this));
    closeDotacioBtn.addEventListener(
      "click",
      this.closeDotacioModal.bind(this)
    );

    this.dotacioModalElement.addEventListener("click", (event) => {
      if (event.target === this.dotacioModalElement) this.closeDotacioModal();
    });

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        this.dotacioModalElement.style.display === "block"
      ) {
        this.closeDotacioModal();
      }
    });

    this.optionsContainerElement.addEventListener(
      "click",
      this.handleOptionsClick.bind(this)
    );

    const inputsToWatch = [
      DOM_IDS.VEHICLE_INPUT,
      DOM_IDS.PERSON1_INPUT,
      DOM_IDS.PERSON2_INPUT,
    ];
    inputsToWatch.forEach((inputId) => {
      const input = document.getElementById(inputId);
      input?.addEventListener("input", () => {
        const group = input.closest(SELECTORS.PERSON_INPUT_GROUP);
        if (group) group.classList.remove(CSS_CLASSES.INPUT_ERROR);
        else input.classList.remove(CSS_CLASSES.INPUT_ERROR);
      });
    });

    this.isInitialized = true;
  }

  /**
   * Carga las dotaciones desde localStorage.
   */
  loadDotacionsFromStorage() {
    try {
      const savedJson = localStorage.getItem(LS_KEY);
      this.savedDotacions = savedJson ? JSON.parse(savedJson) : [];
      if (!Array.isArray(this.savedDotacions)) this.savedDotacions = [];
    } catch (error) {
      this.savedDotacions = [];
    }
  }

  /**
   * Guarda las dotaciones en localStorage.
   */
  saveDotacionsToStorage() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.savedDotacions));
    } catch (error) {
      showToast("No se han podido guardar las dotaciones.", "error");
    }
  }

  /**
   * Abre el modal de dotaciones.
   */
  openDotacioModal() {
    if (!this.dotacioModalElement) return;
    this.dotacioModalElement.style.display = "block";
    this.dotacioModalElement.style.pointerEvents = "auto";
    document.body.classList.add(CSS_CLASSES.MODAL_OPEN);
    document.body.style.setProperty("pointer-events", "none");
    this.displayDotacioOptions();
  }

  /**
   * Cierra el modal de dotaciones.
   */
  closeDotacioModal() {
    if (!this.dotacioModalElement) return;
    this.dotacioModalElement.style.display = "none";
    this.dotacioModalElement.style.pointerEvents = "";
    document.body.classList.remove(CSS_CLASSES.MODAL_OPEN);
    document.body.style.removeProperty("pointer-events");
    document.getElementById(DOM_IDS.OPEN_MODAL_BTN)?.focus();
  }

  /**
   * Muestra las opciones de dotaciones en el modal.
   */
  displayDotacioOptions() {
    if (!this.optionsContainerElement || !this.dotacioTemplateElement) return;

    this.optionsContainerElement.innerHTML = "";

    if (this.savedDotacions.length === 0) {
      this.noDotacioTextElement?.classList.remove(CSS_CLASSES.HIDDEN);
      this.optionsContainerElement.classList.add(CSS_CLASSES.HIDDEN);
    } else {
      this.noDotacioTextElement?.classList.add(CSS_CLASSES.HIDDEN);
      this.optionsContainerElement.classList.remove(CSS_CLASSES.HIDDEN);
      this.savedDotacions.forEach((dotacio, index) => {
        const clone = this.dotacioTemplateElement.content.cloneNode(true);
        const infoSpan = clone.querySelector(SELECTORS.DOTACIO_INFO);
        const loadBtn = clone.querySelector(SELECTORS.LOAD_BTN);

        const dotacioItem = clone.firstElementChild;
        const uniqueId =
          `${dotacio.numero}-${dotacio.conductor}-${dotacio.ajudant}`.replace(
            /\s/g,
            ""
          );
        dotacioItem.setAttribute("data-dotacio-id", uniqueId);

        if (infoSpan)
          infoSpan.textContent = this.formatDotacioListText(dotacio);
        if (loadBtn) loadBtn.setAttribute(DATA_ATTRIBUTES.INDEX, index);

        this.optionsContainerElement.appendChild(clone);

        initSwipeToDeleteDotacio(dotacioItem, uniqueId);
        initMouseSwipeToDeleteDotacio(dotacioItem, uniqueId);
      });
    }
  }

  /**
   * Formatea el texto para una dotación en la lista.
   * @param {Object} dotacio - La dotación a formatear.
   * @returns {string} El texto formateado.
   */
  formatDotacioListText(dotacio) {
    const unitat = dotacio.numero || "S/N";
    let conductorText = capitalizeWords(dotacio.conductor || "");
    let ayudanteText = capitalizeWords(dotacio.ajudant || "");
    let personasText = `${conductorText} / ${ayudanteText}`;

    if (conductorText || ayudanteText) {
      personasText = ` - ${personasText}`;
    } else {
      personasText = "";
    }

    let finalText = `${unitat}${personasText}`;

    const textWidth = this.measureTextWidth(finalText);

    if (textWidth > MAX_TEXT_WIDTH) {
      const shortConductor = dotacio.conductor
        ? this.shortenPersonName(dotacio.conductor)
        : "";
      const shortAyudante = dotacio.ajudant
        ? this.shortenPersonName(dotacio.ajudant)
        : "";
      let shortPersonasText = `${shortConductor} / ${shortAyudante}`;

      if (shortConductor || shortAyudante) {
        shortPersonasText = ` - ${shortPersonasText}`;
      } else {
        shortPersonasText = "";
      }

      finalText = `${unitat}${shortPersonasText}`;
    }

    return finalText;
  }

  /**
   * Acorta un nombre completo a nombre e iniciales de apellidos.
   * @param {string} fullName - Nombre completo.
   * @returns {string} Nombre acortado.
   */
  shortenPersonName(fullName) {
    if (!fullName || typeof fullName !== "string") return "";
    const parts = fullName
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    if (parts.length === 0) return "";
    if (parts.length === 1) return capitalizeWords(parts[0]);

    const articles = new Set([
      "de",
      "la",
      "del",
      "el",
      "los",
      "las",
      "von",
      "van",
      "d'",
      "es",
      "da",
      "dels",
      "i",
      "y",
    ]);

    const filteredParts = parts.filter(
      (part) => !articles.has(part.toLowerCase())
    );

    if (filteredParts.length === 0) return capitalizeWords(parts[0]);

    const firstName = capitalizeWords(filteredParts[0]);
    const surnames = filteredParts
      .slice(1)
      .map((surname) => surname.charAt(0).toUpperCase() + ".")
      .join(" ");

    return `${firstName} ${surnames}`;
  }

  /**
   * Mide el ancho de un texto usando un elemento temporal.
   * @param {string} text - Texto a medir.
   * @returns {number} Ancho en píxeles.
   */
  measureTextWidth(text) {
    const tempEl = document.createElement("span");
    tempEl.style.visibility = "hidden";
    tempEl.style.whiteSpace = "nowrap";
    tempEl.style.fontSize = getComputedStyle(document.body).fontSize;
    tempEl.style.fontFamily = getComputedStyle(document.body).fontFamily;
    tempEl.textContent = text;
    document.body.appendChild(tempEl);
    const width = tempEl.offsetWidth;
    document.body.removeChild(tempEl);
    return width;
  }

  /**
   * Carga una dotación por índice.
   * @param {number} index - Índice de la dotación.
   */
  loadDotacionByIndex(index) {
    if (index < 0 || index >= this.savedDotacions.length) return;
    const selected = this.savedDotacions[index];

    this.clearDotacionInputErrors();

    document.getElementById(DOM_IDS.VEHICLE_INPUT).value =
      selected.numero || "";
    document.getElementById(DOM_IDS.PERSON1_INPUT).value =
      selected.conductor || "";
    document.getElementById(DOM_IDS.PERSON2_INPUT).value =
      selected.ajudant || "";

    setSignatureConductor(selected.firmaConductor || "");
    setSignatureAjudant(selected.firmaAjudant || "");

    showToast(`Dotación ${selected.numero} cargada.`, "success");
    this.closeDotacioModal();
  }

  /**
   * Maneja la eliminación de una dotación por ID.
   * @param {string} dotacioId - ID de la dotación.
   */
  async handleDeleteById(dotacioId) {
    const indexToDelete = this.savedDotacions.findIndex((d) => {
      const currentId = `${d.numero}-${d.conductor}-${d.ajudant}`.replace(
        /\s/g,
        ""
      );
      return currentId === dotacioId;
    });

    if (indexToDelete === -1) {
      console.warn(
        "Se intentó eliminar una dotación que ya no existe:",
        dotacioId
      );
      return;
    }

    const dotacionToDelete = this.savedDotacions[indexToDelete];
    const dotBackup = { ...dotacionToDelete, originalIndex: indexToDelete };

    this.savedDotacions.splice(indexToDelete, 1);
    this.saveDotacionsToStorage();

    updateDotacioListVisibility();

    showToast("Dotación eliminada.", "success", 5000, {
      queueable: false,
      undoCallback: () => {
        this.savedDotacions.splice(dotBackup.originalIndex, 0, dotBackup);
        this.saveDotacionsToStorage();
        restoreDotacioItemToList(dotBackup);
        showToast("Dotación restaurada.", "success");
      },
    });
  }

  /**
   * Maneja clics en las opciones del modal.
   * @param {Event} event - Evento de clic.
   */
  handleOptionsClick(event) {
    const target = event.target;
    const loadButton = target.closest(SELECTORS.LOAD_BTN);

    if (loadButton) {
      event.stopPropagation();
      const index = parseInt(
        loadButton.getAttribute(DATA_ATTRIBUTES.INDEX),
        10
      );
      if (!isNaN(index)) this.loadDotacionByIndex(index);
    }
  }

  /**
   * Obtiene los valores de los inputs de dotación.
   * @returns {Object} Valores de los inputs.
   */
  getDotacionInputValues() {
    const vehicleInput = document.getElementById(DOM_IDS.VEHICLE_INPUT);
    const conductorInput = document.getElementById(DOM_IDS.PERSON1_INPUT);
    const ayudanteInput = document.getElementById(DOM_IDS.PERSON2_INPUT);

    return {
      vehiculo: vehicleInput?.value.trim() || "",
      conductor: conductorInput?.value.trim() || "",
      ayudante: ayudanteInput?.value.trim() || "",
    };
  }

  /**
   * Encuentra el índice de una dotación existente.
   * @param {string} vehiculo - Número de vehículo.
   * @param {string} conductor - Nombre del conductor.
   * @param {string} ayudante - Nombre del ayudante.
   * @returns {number} Índice o -1 si no existe.
   */
  findExistingDotacionIndex(vehiculo, conductor, ayudante) {
    const vLower = vehiculo.toLowerCase();
    const cLower = conductor.toLowerCase();
    const aLower = ayudante.toLowerCase();
    return this.savedDotacions.findIndex(
      (d) =>
        d.numero.toLowerCase() === vLower &&
        d.conductor.toLowerCase() === cLower &&
        d.ajudant.toLowerCase() === aLower
    );
  }

  /**
   * Añade o actualiza una dotación desde el formulario principal.
   */
  addDotacioFromMainForm() {
    if (!validateDotacioTab()) return;

    const { vehiculo, conductor, ayudante } = this.getDotacionInputValues();
    const firmaConductor = getSignatureConductor();
    const firmaAjudant = getSignatureAjudant();

    const existingIndex = this.findExistingDotacionIndex(
      vehiculo,
      conductor,
      ayudante
    );

    const newDotacionData = {
      numero: vehiculo,
      conductor,
      ajudant: ayudante,
      firmaConductor,
      firmaAjudant,
    };

    if (existingIndex !== -1) {
      this.savedDotacions[existingIndex] = newDotacionData;
      showToast(`Dotación ${vehiculo} actualizada.`, "success");
    } else {
      this.savedDotacions.push(newDotacionData);
      showToast(`Dotación ${vehiculo} creada.`, "success");
    }

    this.saveDotacionsToStorage();
  }

  /**
   * Limpia los errores en los inputs de dotación.
   */
  clearDotacionInputErrors() {
    const vehicleInput = document.getElementById(DOM_IDS.VEHICLE_INPUT);
    const conductorInput = document.getElementById(DOM_IDS.PERSON1_INPUT);
    const ayudanteInput = document.getElementById(DOM_IDS.PERSON2_INPUT);

    const conductorGroup = conductorInput?.closest(
      SELECTORS.PERSON_INPUT_GROUP
    );
    const ayudanteGroup = ayudanteInput?.closest(SELECTORS.PERSON_INPUT_GROUP);

    vehicleInput?.classList.remove(CSS_CLASSES.INPUT_ERROR);
    conductorGroup?.classList.remove(CSS_CLASSES.INPUT_ERROR);
    ayudanteGroup?.classList.remove(CSS_CLASSES.INPUT_ERROR);
  }
}

export const dotacionService = new DotacionService();
