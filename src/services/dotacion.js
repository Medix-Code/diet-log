/**
 * @file dotacion.js
 * @description Gestiona dotaciones con localStorage (con encriptación).
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
import { logger } from "../utils/logger.js";

// Encriptació de dotacions
import { getMasterKey, isKeySystemInitialized } from "../utils/keyManager.js";

// Repository per IndexedDB
import {
  saveDotacions as saveToIndexedDB,
  loadDotacions as loadFromIndexedDB,
  migrateDotacionsFromLocalStorage,
} from "../db/dotacionsRepository.js";

const log = logger.withScope("DotacionService");

// --- Constantes ---
const LS_KEY = "dotacions_v2";
const LS_ENCRYPTED_FLAG = "dotacions_encrypted";
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
const ENCRYPTION_DISABLED_DEFAULT_MESSAGE =
  "⚠️ L'encriptació de dotacions no està disponible. Les dotacions es guardaran sense xifrar fins que es resolgui el problema.";

class DotacionService {
  constructor() {
    this.savedDotacions = [];
    this.dotacioModalElement = null;
    this.optionsContainerElement = null;
    this.dotacioTemplateElement = null;
    this.noDotacioTextElement = null;
    this.isInitialized = false;
    this.encryptionSupported = true;
    this.encryptionDisabledReason = "";
    this.hasShownEncryptionWarning = false;
  }

  /**
   * Inicializa el servicio.
   * @export
   */
  async init() {
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

    await this.loadDotacionsFromStorage();

    if (!this.encryptionSupported) {
      // Mostra avís després de carregar les dades sense encriptar
      this.showEncryptionDisabledWarning();
    }

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
   * Habilita o deshabilita l'encriptació per dotacions.
   * @param {boolean} isSupported - Estat de suport.
   * @param {string} [reason] - Missatge personalitzat a mostrar.
   */
  setEncryptionSupport(isSupported, reason = "") {
    this.encryptionSupported = Boolean(isSupported);
    if (!this.encryptionSupported) {
      this.encryptionDisabledReason =
        reason || ENCRYPTION_DISABLED_DEFAULT_MESSAGE;
    } else {
      this.encryptionDisabledReason = "";
      this.hasShownEncryptionWarning = false;
    }
  }

  /**
   * Mostra l'avís d'encriptació deshabilitada només una vegada.
   */
  showEncryptionDisabledWarning() {
    if (this.encryptionSupported || this.hasShownEncryptionWarning) return;

    showToast(
      this.encryptionDisabledReason || ENCRYPTION_DISABLED_DEFAULT_MESSAGE,
      "warning",
      7000
    );
    this.hasShownEncryptionWarning = true;
  }

  /**
   * Carrega les dotacions des de localStorage quan l'encriptació no està disponible.
   */
  loadDotacionsFromLegacyStorage() {
    try {
      const rawData = localStorage.getItem(LS_KEY);
      if (!rawData) {
        this.savedDotacions = [];
        return;
      }

      const parsed = JSON.parse(rawData);
      this.savedDotacions = Array.isArray(parsed) ? parsed : [];
      if (!Array.isArray(parsed)) {
        log.warn(
          "Format de dotacions sense encriptar invàlid. S'inicia llista buida."
        );
      }
    } catch (error) {
      log.error("Error carregant dotacions sense encriptació:", error);
      this.savedDotacions = [];
      showToast(
        "Error carregant dotacions sense encriptació. Les dades poden no estar disponibles.",
        "error",
        6000
      );
    } finally {
      this.showEncryptionDisabledWarning();
    }
  }

  /**
   * Carga las dotaciones desde IndexedDB (con desencriptación).
   */
  async loadDotacionsFromStorage() {
    if (!this.encryptionSupported) {
      this.loadDotacionsFromLegacyStorage();
      return;
    }

    try {
      // 🔄 MIGRACIÓ AUTOMÀTICA: localStorage → IndexedDB (només primera vegada)
      await migrateDotacionsFromLocalStorage();

      // Carregar des d'IndexedDB
      const savedData = await loadFromIndexedDB();
      if (!savedData) {
        this.savedDotacions = [];
        return;
      }

      // Comprovar si les dades estan encriptades (sempre haurien d'estar-ho)
      const isEncrypted = savedData.version && savedData.algorithm;

      if (isEncrypted) {
        // Desencriptar dotacions (FAIL-CLOSED: no fallback a text pla)
        if (!(await isKeySystemInitialized())) {
          log.error(
            "❌ Sistema de claus NO inicialitzat. No es poden carregar dotacions encriptades."
          );
          showToast(
            "Error de seguretat: No es poden carregar les dotacions. Proveu recarregar la pàgina.",
            "error",
            5000
          );
          this.savedDotacions = [];
          return;
        }

        try {
          const masterKey = await getMasterKey();
          const decryptedData = await decryptDotacionsData(
            savedData,
            masterKey
          );
          this.savedDotacions = decryptedData;
          log.debug("🔓 Dotacions desencriptades correctament");
        } catch (decryptError) {
          log.error("❌ Error CRÍTIC desencriptant dotacions:", decryptError);
          showToast(
            "Dotacions antigues no compatibles amb l'actualització. Torneu-les a crear al formulari principal.",
            "error",
            7000
          );
          this.savedDotacions = [];
          // NO fer fallback a text pla per seguretat
        }
      } else {
        // 🔄 MIGRACIÓ: Dades antigues detectades en text pla (només localStorage antic)
        log.warn("⚠️ Dotacions en text pla detectades (format antic insegur)");

        // Carregar dades antigues (ja vindran de localStorage si és primera migració)
        this.savedDotacions = Array.isArray(savedData) ? savedData : [];

        // Avisar l'usuari sobre la migració necessària
        if (this.savedDotacions.length > 0) {
          showToast(
            `⚠️ S'han detectat ${this.savedDotacions.length} dotació(ns) sense encriptar. S'encriptaran automàticament.`,
            "warning",
            5000
          );

          log.debug("📦 Migrant dotacions a format encriptat...");

          // Intentar migrar automàticament
          try {
            await this.saveDotacionsToStorage();
            showToast(
              "✅ Dotacions migrades i encriptades a IndexedDB!",
              "success",
              5000
            );
            log.info("✅ Migració completada amb èxit");
          } catch (migrationError) {
            log.error("❌ Error migrant dotacions:", migrationError);
            showToast(
              "⚠️ No s'han pogut encriptar les dotacions. Deseu-les de nou per encriptar-les.",
              "error",
              7000
            );
          }
        }
      }

      if (!Array.isArray(this.savedDotacions)) {
        this.savedDotacions = [];
      }
    } catch (error) {
      log.error("Error carregant dotacions:", error);
      this.savedDotacions = [];
    }
  }

  /**
   * Guarda las dotaciones en IndexedDB (con encriptación OBLIGATORIA).
   */
  async saveDotacionsToStorage() {
    if (!this.encryptionSupported) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.savedDotacions));
        localStorage.setItem(LS_ENCRYPTED_FLAG, "false");
        this.showEncryptionDisabledWarning();
      } catch (error) {
        log.error("Error guardant dotacions sense encriptació:", error);
        showToast(
          "Error guardant dotacions sense encriptació. Comproveu l'espai disponible.",
          "error",
          6000
        );
        throw error;
      }
      return;
    }

    try {
      // 🔐 ENCRIPTACIÓ OBLIGATÒRIA (fail-closed): Sistema de claus REQUERIT
      if (!(await isKeySystemInitialized())) {
        log.error(
          "❌ Sistema de claus NO inicialitzat. NO es poden guardar dotacions."
        );
        showToast(
          "Error de seguretat: Sistema d'encriptació no disponible. Proveu recarregar la pàgina.",
          "error",
          5000
        );
        throw new Error(
          "Sistema de claus no inicialitzat - guardat bloquejat per seguretat"
        );
      }

      const masterKey = await getMasterKey();
      const encryptedData = await encryptDotacionsData(
        this.savedDotacions,
        masterKey
      );

      // Guardar a IndexedDB enlloc de localStorage
      await saveToIndexedDB(encryptedData);

      log.debug("🔒 Dotacions guardades encriptades a IndexedDB");
    } catch (error) {
      log.error("❌ Error CRÍTIC guardant dotacions:", error);
      showToast(
        "Error crític: Les dotacions NO s'han desat per seguretat.",
        "error",
        5000
      );
      throw error; // Propagar l'error per evitar desar en text pla
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
    await this.saveDotacionsToStorage();

    updateDotacioListVisibility();

    showToast("Dotación eliminada.", "success", 5000, {
      queueable: false,
      undoCallback: async () => {
        this.savedDotacions.splice(dotBackup.originalIndex, 0, dotBackup);
        await this.saveDotacionsToStorage();
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
  async addDotacioFromMainForm() {
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

    await this.saveDotacionsToStorage();
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

// --- Funcions d'encriptació per dotacions ---

/**
 * Encripta les dades de dotacions
 * @param {Array} dotacions - Array de dotacions
 * @param {CryptoKey} key - Clau mestra
 * @returns {Promise<Object>} Dades encriptades
 */
async function encryptDotacionsData(dotacions, key) {
  try {
    // Convertir dades a JSON i després a ArrayBuffer
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(dotacions));

    // Generar IV únic
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encriptar amb AES-GCM
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv,
        tagLength: 128,
      },
      key,
      dataBuffer
    );

    // Convertir a Base64 per localStorage
    const encryptedData = arrayBufferToBase64(encryptedBuffer);
    const ivBase64 = arrayBufferToBase64(iv);

    // Calcular checksum per integritat
    const checksum = await calculateChecksum(encryptedData);

    return {
      version: 1,
      algorithm: "AES-GCM",
      iv: ivBase64,
      data: encryptedData,
      checksum: checksum,
    };
  } catch (error) {
    log.error("Error encriptant dotacions:", error);
    throw error;
  }
}

/**
 * Desencripta les dades de dotacions
 * @param {Object} encryptedData - Dades encriptades
 * @param {CryptoKey} key - Clau mestra
 * @returns {Promise<Array>} Array de dotacions
 */
async function decryptDotacionsData(encryptedData, key) {
  try {
    // Validar format
    if (!encryptedData || !encryptedData.data || !encryptedData.iv) {
      throw new Error("Format de dades encriptades invàlid");
    }

    // Validar checksum (integritat)
    let checksumValid = true;
    if (encryptedData.checksum) {
      const currentChecksum = await calculateChecksum(encryptedData.data);
      if (currentChecksum !== encryptedData.checksum) {
        checksumValid = false;
        log.error("⚠️ CHECKSUM MISMATCH en dotacions - Integritat compromesa");

        // Mostrar advertència a l'usuari
        showToast(
          "⚠️ Advertència: Les dotacions poden estar corruptes. El checksum no coincideix.",
          "warning",
          7000
        );

        log.warn("Continuant amb desencriptació malgrat checksum invàlid");
      }
    }

    // Convertir de Base64 a ArrayBuffer
    const encryptedBuffer = base64ToArrayBuffer(encryptedData.data);
    const iv = base64ToArrayBuffer(encryptedData.iv);

    // Desencriptar
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: new Uint8Array(iv),
        tagLength: 128,
      },
      key,
      new Uint8Array(encryptedBuffer)
    );

    // Convertir de ArrayBuffer a Object
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);

    const dotacions = JSON.parse(jsonString);

    log.debug(
      `Dotacions desencriptades (checksum: ${
        checksumValid ? "✅ vàlid" : "⚠️ invàlid"
      })`
    );

    return dotacions;
  } catch (error) {
    log.error("Error desencriptant dotacions:", error);

    // Millorar missatge d'error
    if (error.name === "OperationError") {
      throw new Error(
        "Les dotacions estan corruptes o s'ha utilitzat una clau incorrecta"
      );
    }

    throw error;
  }
}

/**
 * Converteix ArrayBuffer a Base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converteix Base64 a ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Calcula checksum SHA-256
 */
async function calculateChecksum(data) {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    log.error("Error calculant checksum:", error);
    return "";
  }
}

export const dotacionService = new DotacionService();
