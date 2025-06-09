/**
 * @file cameraOcr.js
 * @description Gestiona la funcionalidad de OCR a través de la cámara o galería,
 *              utilizando Tesseract.js, rellenando campos de formulario basados
 *              en patrones predefinidos, y adaptando el estilo del modal al servicio activo.
 * @module cameraOcr
 */

// Importaciones de módulos externos
import { showToast } from "../ui/toast.js";
import {
  getCurrentServiceIndex,
  getModeForService,
} from "../services/servicesPanelManager.js";
import { setControlsDisabled } from "../ui/uiControls.js";

// --- Constantes de Configuración OCR/Imagen ---
const OCR_LANGUAGE = "spa";
const TESSERACT_ENGINE_MODE = 1;
const TESSERACT_CHAR_WHITELIST =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:/-ÀÉÍÓÚÈÒÀÜÏÇÑ";
const IMAGE_MAX_DIMENSION = 1500;
const IMAGE_QUALITY = 0.95;
const IMAGE_TYPE = "image/png";
const MODAL_TRANSITION_DURATION = 300;
const PROGRESS_HIDE_DELAY = 1000;
const OCR_SEARCH_WINDOW = 200;

const TESSERACT_PARAMS = {
  tessedit_char_whitelist: TESSERACT_CHAR_WHITELIST,
  tessedit_pageseg_mode: 6, // Assume a single uniform block of text
  load_system_dawg: false,
  load_freq_dawg: false,
};

// --- IDs y Selectores del DOM ---
const DOM_SELECTORS = {
  CAMERA_BTN: "camera-in-dropdown",
  CAMERA_MODAL: "camera-gallery-modal",
  MODAL_CONTENT: ".modal-bottom-content",
  OPTION_CAMERA: "option-camera",
  OPTION_GALLERY: "option-gallery",
  CAMERA_INPUT: "camera-input",
  OCR_PROGRESS_CONTAINER: ".ocr-progress-container",
  OCR_PROGRESS_TEXT: ".ocr-progress-text",
  OCR_SCAN_BTN: ".btn-ocr-inline",
};

// --- Clases CSS ---
const CSS_CLASSES = {
  VISIBLE: "visible",
  HIDDEN: "hidden",
  SERVICE_COLORS: ["service-1", "service-2", "service-3", "service-4"],
};

// --- Configuración de Patrones OCR (SOLO PARA HORAS) ---

/** Normaliza una cadena de tiempo a HH:MM. */
const _normalizeTime = (timeStr) => {
  if (!timeStr) return "";
  let cleaned = timeStr.replace(/[^\d:-]/g, "");
  cleaned = cleaned.replace(/-/g, ":");
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}`;
    }
  }
  return "";
};

const OCR_PATTERNS = {
  ORIGIN_TIME: {
    id: "originTime",
    label: "Hora Origen",
    fieldIdSuffix: "origin-time",
    lineKeywordRegex: /mobilitzat|ltat/i,
  },
  DESTINATION_TIME: {
    id: "destinationTime",
    label: "Hora Destino",
    fieldIdSuffix: "destination-time",
    lineKeywordRegex: /arribada|hospital|aaah/i,
  },
  END_TIME: {
    id: "endTime",
    label: "Hora Final",
    fieldIdSuffix: "end-time",
    valueRegex:
      /\d{2}\s*\/?\s*\d{2}\s*\/?\s*\d{2}\s+(\d{1,2}:\d{2}(?::\d{2})?)/i,
  },
};

// --- Variables / Cache DOM ---
let cameraBtn = null;
let cameraGalleryModal = null;
let modalContentElement = null;
let optionCameraBtn = null;
let optionGalleryBtn = null;
let cameraInput = null;

// --- Variables de Estado ---
let isProcessing = false;
let isInitialized = false;

// --- Funciones Privadas ---

function _openCameraModal() {
  if (!cameraGalleryModal || !modalContentElement) return;
  document.body.classList.add("modal-open");

  const currentServiceIdx = getCurrentServiceIndex();
  const currentColorClass = CSS_CLASSES.SERVICE_COLORS[currentServiceIdx] || "";
  modalContentElement.classList.remove(...CSS_CLASSES.SERVICE_COLORS);
  if (currentColorClass) modalContentElement.classList.add(currentColorClass);
  cameraGalleryModal.classList.remove(CSS_CLASSES.HIDDEN);
  void cameraGalleryModal.offsetWidth;
  requestAnimationFrame(() =>
    cameraGalleryModal.classList.add(CSS_CLASSES.VISIBLE)
  );
  optionCameraBtn?.focus();
}

function _closeCameraModal() {
  if (!cameraGalleryModal) return;
  document.body.classList.remove("modal-open");
  cameraGalleryModal.classList.remove(CSS_CLASSES.VISIBLE);
  cameraBtn?.focus();
  setTimeout(
    () => cameraGalleryModal.classList.add(CSS_CLASSES.HIDDEN),
    MODAL_TRANSITION_DURATION
  );
}

function _handleOutsideClick(event) {
  if (
    cameraGalleryModal?.classList.contains(CSS_CLASSES.VISIBLE) &&
    !modalContentElement?.contains(event.target) &&
    !cameraBtn?.contains(event.target)
  ) {
    _closeCameraModal();
  }
}

function _triggerCameraCapture() {
  if (!cameraInput) return;
  cameraInput.setAttribute("capture", "environment");
  cameraInput.click();
  _closeCameraModal();
}

function _triggerGallerySelection() {
  if (!cameraInput) return;
  cameraInput.removeAttribute("capture");
  cameraInput.click();
  _closeCameraModal();
}

function _getActiveServicePanelElement() {
  return document.querySelector(".service:not(.hidden)");
}

function _updateOcrProgress(percent, statusText) {
  const currentServicePanel = _getActiveServicePanelElement();
  const progressContainer = currentServicePanel?.querySelector(
    DOM_SELECTORS.OCR_PROGRESS_CONTAINER
  );
  if (!progressContainer) return;

  if (progressContainer.classList.contains(CSS_CLASSES.HIDDEN)) {
    progressContainer.classList.remove(CSS_CLASSES.HIDDEN);
  }

  const progressText = progressContainer.querySelector(
    DOM_SELECTORS.OCR_PROGRESS_TEXT
  );
  if (progressText) progressText.textContent = statusText;
}

function _hideOcrProgress() {
  const currentServicePanel = _getActiveServicePanelElement();
  const progressContainer = currentServicePanel?.querySelector(
    DOM_SELECTORS.OCR_PROGRESS_CONTAINER
  );
  if (!progressContainer) return;

  setTimeout(() => {
    progressContainer.classList.add(CSS_CLASSES.HIDDEN);
  }, PROGRESS_HIDE_DELAY);
}

async function _resizeImage(file) {
  try {
    const img = await createImageBitmap(file);
    const { width: originalWidth, height: originalHeight } = img;
    if (Math.max(originalWidth, originalHeight) <= IMAGE_MAX_DIMENSION) {
      img.close();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) =>
          resolve(new Blob([e.target.result], { type: file.type }));
        reader.onerror = (e) =>
          reject(new Error("Error leyendo el archivo: " + e));
        reader.readAsArrayBuffer(file);
      });
    }
    const ratio = Math.min(
      IMAGE_MAX_DIMENSION / originalWidth,
      IMAGE_MAX_DIMENSION / originalHeight
    );
    const width = Math.round(originalWidth * ratio);
    const height = Math.round(originalHeight * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas.");
    ctx.drawImage(img, 0, 0, width, height);
    img.close();
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error("La conversión de canvas a blob ha fallado.")),
        IMAGE_TYPE,
        IMAGE_QUALITY
      );
    });
  } catch (error) {
    console.error("Error redimensionando la imagen:", error);
    showToast("Error al procesar la imagen.", "error");
    throw error;
  }
}

async function _preprocessImage(blob) {
  try {
    const img = await createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx)
      throw new Error("No se ha podido obtener el contexto 2D del canvas.");

    ctx.filter = "grayscale(100%) contrast(180%) brightness(110%)";
    ctx.drawImage(img, 0, 0);
    img.close();

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (processedBlob) => {
          if (processedBlob) {
            resolve(processedBlob);
          } else {
            reject(
              new Error(
                "La conversión de canvas a blob para el preprocesamiento ha fallado."
              )
            );
          }
        },
        IMAGE_TYPE,
        1.0
      );
    });
  } catch (error) {
    console.error("Error durante el preprocesamiento de la imagen:", error);
    showToast("Error al mejorar la imagen para el escaneo.", "error");
    throw error;
  }
}

function _safeSetFieldValue(fieldId, value, fieldName) {
  try {
    const element = document.getElementById(fieldId);
    if (element) {
      element.value = value;
      console.log(`[OCR Fill] ${fieldName} (${fieldId}) = "${value}"`);
    }
  } catch (error) {
    console.error(
      `[OCR Fill] Error rellenando el campo ${fieldName} (${fieldId}):`,
      error
    );
  }
}

/**
 * Gestiona la selecció d'un fitxer, inicia el procés OCR, fa scroll fins al final
 * i actualitza el formulari amb els resultats.
 */
async function _handleFileChange(event) {
  if (isProcessing) {
    showToast("Proceso OCR ya en marcha.", "warning");
    return;
  }
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Por favor, selecciona un archivo de imagen.", "error");
    if (cameraInput) cameraInput.value = "";
    return;
  }

  isProcessing = true;
  setControlsDisabled(true);
  _updateOcrProgress(0, "Preparando imagen...");

  // >>> LÒGICA DE SCROLL MODIFICADA <<<
  // Fa scroll fins al final de la pàgina mentre es processa la imatge.
  console.log(`[UI] Iniciando scroll hacia el final de la página.`);
  _scrollToBottom();

  let worker = null;

  try {
    let imageBlob = await _resizeImage(file);
    imageBlob = await _preprocessImage(imageBlob);

    _updateOcrProgress(5, "Cargando motor OCR...");
    worker = await Tesseract.createWorker(OCR_LANGUAGE, TESSERACT_ENGINE_MODE, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          const percent = Math.max(10, Math.floor(m.progress * 100));
          _updateOcrProgress(percent, `Reconociendo texto ${percent}%...`);
        } else if (m.status === "loading language model") {
          _updateOcrProgress(5, "Cargando modelo de idioma...");
        }
      },
    });
    await worker.setParameters(TESSERACT_PARAMS);

    _updateOcrProgress(10, "Reconociendo texto 10%...");
    const {
      data: { text: ocrText },
    } = await worker.recognize(imageBlob);
    _updateOcrProgress(100, "Análisis completado.");

    // Aquesta funció s'encarrega d'omplir els camps amb les dades trobades
    _processAndFillForm(ocrText);
  } catch (error) {
    console.error("[cameraOcr] Error OCR:", error);
    showToast(`Error de escaneo: ${error.message || "Desconocido"}`, "error");
    _updateOcrProgress(0, "Error en el escaneo.");
  } finally {
    if (worker) {
      await worker.terminate();
      console.log("[cameraOcr] Worker de Tesseract finalizado.");
    }
    if (cameraInput) cameraInput.value = "";
    _hideOcrProgress();
    setControlsDisabled(false);
    isProcessing = false;
  }
}

// >>> 3. LA TEVA FUNCIÓ _processAndFillForm ES QUEDA EXACTAMENT COM ESTAVA <<<
// Aquesta funció va dins del teu fitxer cameraOcr.js
// Només has de substituir la funció _processAndFillForm existent per aquesta.

function _processAndFillForm(ocrText) {
  console.log("--- TEXTO COMPLETO RECONOCIDO POR TESSERACT ---");
  console.log(`Valor de ocrText:`, ocrText);
  console.log("-------------------------------------------");

  if (!ocrText || !ocrText.trim()) {
    showToast("No se pudo reconocer texto en esta imagen.", "warning");
    return;
  }

  // Preparación de variables
  const currentServiceIndex = getCurrentServiceIndex();
  const currentMode = getModeForService(currentServiceIndex) || "3.6";
  const suffix = `-${currentServiceIndex + 1}`;
  let filledFields = {};

  const lines = ocrText.split("\n");
  const processedText = ocrText.toLowerCase().replace(/ +/g, " ");

  console.log(
    `[OCR Proc] Procesando para el servicio ${
      currentServiceIndex + 1
    } en modo ${currentMode}`
  );

  // Bucle principal para extraer datos
  Object.values(OCR_PATTERNS).forEach((pattern) => {
    if (
      (currentMode === "3.11" || currentMode === "3.22") &&
      pattern.id === "destinationTime"
    ) {
      return;
    }

    let valueMatch = null;

    if (pattern.lineKeywordRegex) {
      for (const line of lines) {
        if (pattern.lineKeywordRegex.test(line.toLowerCase())) {
          const cleanedLine = line.replace(/\D/g, "");
          if (cleanedLine.length >= 6) {
            const timeDigits = cleanedLine.slice(-6);
            const formattedTime = `${timeDigits.slice(0, 2)}:${timeDigits.slice(
              2,
              4
            )}:${timeDigits.slice(4, 6)}`;
            valueMatch = [null, formattedTime];
            break;
          }
        }
      }
    } else if (pattern.valueRegex) {
      valueMatch = processedText.match(pattern.valueRegex);
    }

    if (valueMatch && valueMatch[1]) {
      let extractedValue = _normalizeTime(valueMatch[1].trim());
      if (extractedValue && !filledFields[pattern.id]) {
        const fieldId = `${pattern.fieldIdSuffix}${suffix}`;
        _safeSetFieldValue(fieldId, extractedValue, pattern.label);
        filledFields[pattern.id] = pattern;
      }
    }
  });

  // Lógica de Fallback para Hora Final (con feedback visual y depuración)
  if (
    !filledFields.endTime &&
    (filledFields.originTime || filledFields.destinationTime)
  ) {
    console.warn(
      "[OCR Fallback] Hora Final no encontrada. Activando fallback."
    );

    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${hh}:${mm}`;
    const fieldId = `end-time${suffix}`;

    _safeSetFieldValue(fieldId, currentTime, "Hora Final (Actual)");

    // Aquí implementem la lògica de l'avís persistent.
    const endTimeElement = document.getElementById(fieldId);
    if (endTimeElement) {
      console.log(`[DEBUG] Aplicant estil d'avís persistent a #${fieldId}`);

      // 1. Afegeix la classe d'avís. Aquesta es quedarà posada.
      endTimeElement.classList.add("input-warning");

      // 2. Afegim un listener que s'executarà NOMÉS UNA VEGADA.
      //    Quan l'usuari faci focus (clic o tab) en el camp, eliminarem l'avís.
      endTimeElement.addEventListener(
        "focus",
        () => {
          console.log(
            `[DEBUG] L'usuari ha interactuat amb #${fieldId}. Eliminant l'avís.`
          );
          endTimeElement.classList.remove("input-warning");
        },
        { once: true }
      ); // Aquesta opció fa que el listener s'elimini sol després d'executar-se.
    }
  }

  // Feedback final al usuario
  const filledCount = Object.keys(filledFields).length;
  if (filledCount > 0) {
    const filledLabels = Object.values(filledFields).map(
      (pattern) => pattern.label
    );
    let message = `Campos actualizados: ${filledLabels.join(", ")}.`;
    showToast(message, "success");
  } else {
    showToast("No se encontraron horas relevantes en la imagen.", "info");
  }
}

// >>> MODIFICA LA FUNCIÓ initCameraOcr <<<
export function initCameraOcr() {
  if (isInitialized) {
    console.warn("[cameraOcr] Ja inicialitzat.");
    return;
  }

  // Cachejem els elements que són únics
  cameraGalleryModal = document.getElementById("camera-gallery-modal");
  modalContentElement = cameraGalleryModal?.querySelector(
    ".modal-bottom-content"
  );
  optionCameraBtn = document.getElementById("option-camera");
  optionGalleryBtn = document.getElementById("option-gallery");
  cameraInput = document.getElementById("camera-input");

  if (
    !cameraGalleryModal ||
    !optionCameraBtn ||
    !optionGalleryBtn ||
    !cameraInput
  ) {
    console.warn("[cameraOcr] Falten elements DOM del modal OCR.");
    return;
  }

  // >>> NOVA LÒGICA PER ALS BOTONS D'ESCANEIG <<<
  // Trobem TOTS els botons per escanejar
  const scanButtons = document.querySelectorAll(DOM_SELECTORS.OCR_SCAN_BTN);

  if (scanButtons.length === 0) {
    console.warn("[cameraOcr] No s'han trobat botons '.btn-ocr-scan'.");
    return;
  }

  // Afegim un listener a cadascun d'ells
  scanButtons.forEach((button) => {
    button.addEventListener("click", _openCameraModal);
  });

  // La resta de listeners per al funcionament del modal i l'input de fitxer
  optionCameraBtn.addEventListener("click", _triggerCameraCapture);
  optionGalleryBtn.addEventListener("click", _triggerGallerySelection);
  cameraInput.addEventListener("change", _handleFileChange);
  document.addEventListener("click", _handleOutsideClick);
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      cameraGalleryModal?.classList.contains(CSS_CLASSES.VISIBLE)
    ) {
      _closeCameraModal();
    }
  });

  isInitialized = true;
  console.log(
    "[cameraOcr] Funcionalitat OCR inicialitzada i lligada als botons de servei."
  );
}

function _scrollToBottom() {
  // window.scrollTo() és la funció nativa per fer scroll a la pàgina.
  window.scrollTo({
    top: document.body.scrollHeight, // La posició vertical on volem anar: l'alçada total del document.
    behavior: "smooth", // Animació suau.
  });
}
