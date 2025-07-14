/**
 * @file dotacion.js
 * @description Gestiona dotacions amb localStorage.
 * @module dotacionService
 */

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
import { showConfirmModal } from "../ui/modals.js";

// --- Constants ---
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
   * Inicialitza el servei.
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
    )
      return;

    this._loadDotacionsFromStorage();

    addDotacioBtn.addEventListener(
      "click",
      this.addDotacioFromMainForm.bind(this)
    );
    openDotacioBtn.addEventListener("click", this._openDotacioModal.bind(this));
    closeDotacioBtn.addEventListener(
      "click",
      this._closeDotacioModal.bind(this)
    );

    this.dotacioModalElement.addEventListener("click", (event) => {
      if (event.target === this.dotacioModalElement) this._closeDotacioModal();
    });

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        this.dotacioModalElement.style.display === "block"
      )
        this._closeDotacioModal();
    });

    this.optionsContainerElement.addEventListener(
      "click",
      this._handleOptionsClick.bind(this)
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

  _loadDotacionsFromStorage() {
    try {
      const savedJson = localStorage.getItem(LS_KEY);
      this.savedDotacions = savedJson ? JSON.parse(savedJson) : [];
      if (!Array.isArray(this.savedDotacions)) this.savedDotacions = [];
    } catch (error) {
      this.savedDotacions = [];
    }
  }

  _saveDotacionsToStorage() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(this.savedDotacions));
    } catch (error) {
      showToast("No s'han pogut desar les dotacions.", "error");
    }
  }

  _validateDotacionInputs() {
    const vehicleInput = document.getElementById(DOM_IDS.VEHICLE_INPUT);
    const conductorInput = document.getElementById(DOM_IDS.PERSON1_INPUT);
    const ajudantInput = document.getElementById(DOM_IDS.PERSON2_INPUT);
    const conductorGroup = conductorInput?.closest(
      SELECTORS.PERSON_INPUT_GROUP
    );
    const ajudantGroup = ajudantInput?.closest(SELECTORS.PERSON_INPUT_GROUP);

    vehicleInput?.classList.remove(CSS_CLASSES.INPUT_ERROR);
    conductorGroup?.classList.remove(CSS_CLASSES.INPUT_ERROR);
    ajudantGroup?.classList.remove(CSS_CLASSES.INPUT_ERROR);

    const values = {
      vehiculo: vehicleInput?.value.trim() || "",
      conductor: conductorInput?.value.trim() || "",
      ajudant: ajudantInput?.value.trim() || "",
    };

    const errors = [];
    if (!values.vehiculo) {
      vehicleInput?.classList.add(CSS_CLASSES.INPUT_ERROR);
      errors.push("Vehículo");
    }

    if (!values.conductor && !values.ajudant) {
      conductorGroup?.classList.add(CSS_CLASSES.INPUT_ERROR);
      ajudantGroup?.classList.add(CSS_CLASSES.INPUT_ERROR);
      errors.push("Conductor o Ayudante");
    }

    if (errors.length > 0) {
      showToast(`Faltan campos obligatorios: ${errors.join(", ")}.`, "error");
      return null;
    }

    return values;
  }

  _findExistingDotacioIndex(vehiculo, conductor, ajudant) {
    const vLower = vehiculo.toLowerCase();
    const cLower = conductor.toLowerCase();
    const aLower = ajudant.toLowerCase();
    return this.savedDotacions.findIndex(
      (d) =>
        d.numero.toLowerCase() === vLower &&
        d.conductor.toLowerCase() === cLower &&
        d.ajudant.toLowerCase() === aLower
    );
  }

  _openDotacioModal() {
    if (!this.dotacioModalElement) return;
    this.dotacioModalElement.style.display = "block";
    document.body.classList.add(CSS_CLASSES.MODAL_OPEN);
    this._displayDotacioOptions();
  }

  _closeDotacioModal() {
    if (!this.dotacioModalElement) return;
    this.dotacioModalElement.style.display = "none";
    document.body.classList.remove(CSS_CLASSES.MODAL_OPEN);
    document.getElementById(DOM_IDS.OPEN_MODAL_BTN)?.focus();
  }

  _displayDotacioOptions() {
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
          infoSpan.textContent = this._formatDotacioListText(dotacio);
        if (loadBtn) loadBtn.setAttribute(DATA_ATTRIBUTES.INDEX, index);

        this.optionsContainerElement.appendChild(clone);

        initSwipeToDeleteDotacio(dotacioItem, uniqueId);
        initMouseSwipeToDeleteDotacio(dotacioItem, uniqueId);
      });
    }
  }

  _formatDotacioListText(dotacio) {
    const unitat = dotacio.numero || "S/N";

    let conductor = dotacio.conductor || "";
    let ajudant = dotacio.ajudant || "";

    let textPersonesComplet = `${conductor} / ${ajudant}`;

    if (conductor || ajudant) {
      textPersonesComplet = ` - ${textPersonesComplet}`;
    } else {
      textPersonesComplet = "";
    }

    let textFinal = `${unitat}${textPersonesComplet}`;

    const tempEl = document.createElement("span");
    tempEl.style.visibility = "hidden";
    tempEl.style.whiteSpace = "nowrap";
    tempEl.style.fontSize = getComputedStyle(document.body).fontSize;
    tempEl.style.fontFamily = getComputedStyle(document.body).fontFamily;
    tempEl.textContent = textFinal;
    document.body.appendChild(tempEl);
    const textWidth = tempEl.offsetWidth;
    document.body.removeChild(tempEl);

    const maxWidth = 180;

    if (textWidth > maxWidth) {
      if (conductor) conductor = this._shortNameAndSurname(conductor);
      if (ajudant) ajudant = this._shortNameAndSurname(ajudant);

      let textPersonesEscurcat = `${conductor} / ${ajudant}`;

      if (conductor || ajudant) {
        textPersonesEscurcat = ` - ${textPersonesEscurcat}`;
      } else {
        textPersonesEscurcat = "";
      }

      textFinal = `${unitat}${textPersonesEscurcat}`;
    }

    return textFinal;
  }

  _shortNameAndSurname(fullName) {
    if (!fullName || typeof fullName !== "string") return "S/D";
    const parts = fullName
      .trim()
      .split(/\s+/)
      .filter((part) => part.length > 0);

    if (parts.length === 0) return "S/D";
    if (parts.length === 1) return parts[0];

    // Llista d'articles a ignorar (ampliada)
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

    // Filtra articles i obté nom + cognoms rellevants
    const filteredParts = parts.filter(
      (part) => !articles.has(part.toLowerCase())
    );

    // Primer nom + inicials dels cognoms
    const firstName = filteredParts[0];
    const surnames = filteredParts
      .slice(1)
      .map((surname) => surname[0] + ".")
      .join("");

    return `${firstName} ${surnames}`;
  }

  _loadDotacio(index) {
    if (index < 0 || index >= this.savedDotacions.length) return;
    const selected = this.savedDotacions[index];

    this._clearDotacionInputErrors();

    document.getElementById(DOM_IDS.VEHICLE_INPUT).value =
      selected.numero || "";
    document.getElementById(DOM_IDS.PERSON1_INPUT).value =
      selected.conductor || "";
    document.getElementById(DOM_IDS.PERSON2_INPUT).value =
      selected.ajudant || "";

    setSignatureConductor(selected.firmaConductor || "");
    setSignatureAjudant(selected.firmaAjudant || "");

    showToast(`Dotación ${selected.numero} cargada.`, "success");
    this._closeDotacioModal();
  }

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
        "S'ha intentat eliminar una dotació que ja no existeix:",
        dotacioId
      );
      return;
    }

    const dotacioToDelete = this.savedDotacions[indexToDelete];
    const displayText = this._formatDotacioListText(dotacioToDelete);
    const dotacioBackup = { ...dotacioToDelete, originalIndex: indexToDelete };

    this.savedDotacions.splice(indexToDelete, 1);
    this._saveDotacionsToStorage();

    updateDotacioListVisibility();

    showToast(`Dotación eliminada.`, "success", 5000, {
      undoCallback: async () => {
        this.savedDotacions.splice(
          dotacioBackup.originalIndex,
          0,
          dotacioBackup
        );
        this._saveDotacionsToStorage();
        restoreDotacioItemToList(dotacioBackup);
        showToast("Dotacion restaurada.", "success");
      },
    });
  }

  _handleOptionsClick(event) {
    const target = event.target;
    const loadButton = target.closest(SELECTORS.LOAD_BTN);

    if (loadButton) {
      event.stopPropagation();
      const index = parseInt(
        loadButton.getAttribute(DATA_ATTRIBUTES.INDEX),
        10
      );
      if (!isNaN(index)) this._loadDotacio(index);
    }
  }
  /**
   *
   * Funció que s'executa quan l'usuari prem el botó de desar.
   * Decideix si s'ha de crear una nova dotació o actualitzar-ne una d'existent.
   */
  addDotacioFromMainForm() {
    const validatedValues = this._validateDotacionInputs();
    if (!validatedValues) return;

    const { vehiculo, conductor, ajudant } = validatedValues;
    const firmaConductor = getSignatureConductor();
    const firmaAjudant = getSignatureAjudant();

    const existingIndex = this._findExistingDotacioIndex(
      vehiculo,
      conductor,
      ajudant
    );

    const newDotacioData = {
      numero: vehiculo,
      conductor,
      ajudant,
      firmaConductor,
      firmaAjudant,
    };

    if (existingIndex !== -1) {
      this.savedDotacions[existingIndex] = newDotacioData;
      showToast(`Dotación ${vehiculo} actualizada.`, "success");
    } else {
      this.savedDotacions.push(newDotacioData);
      showToast(`Dotación ${vehiculo} creada.`, "success");
    }

    this._saveDotacionsToStorage();
  }

  _clearDotacionInputErrors() {
    const vehicleInput = document.getElementById(DOM_IDS.VEHICLE_INPUT);
    const conductorInput = document.getElementById(DOM_IDS.PERSON1_INPUT);
    const ajudantInput = document.getElementById(DOM_IDS.PERSON2_INPUT);

    const conductorGroup = conductorInput?.closest(
      SELECTORS.PERSON_INPUT_GROUP
    );
    const ajudantGroup = ajudantInput?.closest(SELECTORS.PERSON_INPUT_GROUP);

    vehicleInput?.classList.remove(CSS_CLASSES.INPUT_ERROR);
    conductorGroup?.classList.remove(CSS_CLASSES.INPUT_ERROR);
    ajudantGroup?.classList.remove(CSS_CLASSES.INPUT_ERROR);
  }
}

export const dotacionService = new DotacionService();
