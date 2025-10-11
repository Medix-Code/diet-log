// Mòdul per gestionar OCR amb càmera o galeria

import { showToast } from "../ui/toast.js";
import {
  getCurrentServiceIndex,
  getModeForService,
} from "../services/servicesPanelManager.js";
import { setControlsDisabled } from "../ui/uiControls.js";
import { applyCspNonce } from "../utils/utils.js";
import { getOCRFeedbackManager } from "../utils/ocrFeedbackBridge.js";

// --- Constants ---
const OCR_LANGUAGE = "spa";
const TESSERACT_ENGINE_MODE = 1;
const TESSERACT_CHAR_WHITELIST =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:/-ÀÉÍÓÚÈÒÀÜÏÇÑ";
const IMAGE_MAX_DIMENSION = 1500;
const IMAGE_QUALITY = 0.95;
const IMAGE_TYPE = "image/png";
const MAX_IMAGE_SIZE_MB = 10; // Límit de mida d'imatge per prevenció de malware
const MODAL_TRANSITION_DURATION = 300;
const PROGRESS_HIDE_DELAY = 1000;
const OCR_SEARCH_WINDOW = 200;

const TESSERACT_PARAMS = {
  tessedit_char_whitelist: TESSERACT_CHAR_WHITELIST,
  tessedit_pageseg_mode: 6,
  load_system_dawg: false,
  load_freq_dawg: false,
};

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

const CSS_CLASSES = {
  VISIBLE: "visible",
  HIDDEN: "hidden",
  SERVICE_COLORS: ["service-1", "service-2", "service-3", "service-4"],
};

const OCR_PATTERNS = {
  ORIGIN_TIME: {
    id: "originTime",
    label: "Hora movilización",
    fieldIdSuffix: "origin-time",
    // Updated regex for better accuracy
    lineKeywordRegex: /movilizaci|ltat|desplaza/i,
  },
  DESTINATION_TIME: {
    id: "destinationTime",
    label: "Hora de llegada hospital",
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

// --- Estat ---
let cameraGalleryModal = null;
let modalContentElement = null;
let optionCameraBtn = null;
let optionGalleryBtn = null;
let cameraInput = null;

let isProcessing = false;
let isInitialized = false;
let tesseractScriptLoaded = false;
let lastPressOcr = 0;
let ocrFeedback = null; // Nou gestor de feedback OCR

// --- Funcions ---

function _normalizeTime(timeStr) {
  if (!timeStr) return "";
  // Neteja de caràcters no numèrics, mantenint : i -
  let cleaned = timeStr.replace(/[^\d:\-]/g, "");
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
}

function _openCameraModal() {
  // Throttle OCR button clicks to prevent abuse (500ms min interval)
  if (Date.now() - lastPressOcr < 500) return;
  lastPressOcr = Date.now();

  if (!cameraGalleryModal || !modalContentElement) return;
  document.body.classList.add("modal-open");

  const currentServiceIdx = getCurrentServiceIndex();
  const currentColorClass = CSS_CLASSES.SERVICE_COLORS[currentServiceIdx] || "";
  modalContentElement.classList.remove(...CSS_CLASSES.SERVICE_COLORS);
  if (currentColorClass) modalContentElement.classList.add(currentColorClass);
  cameraGalleryModal.classList.remove(CSS_CLASSES.HIDDEN);
  requestAnimationFrame(() =>
    cameraGalleryModal.classList.add(CSS_CLASSES.VISIBLE)
  );
  optionCameraBtn?.focus();
}

function _closeCameraModal() {
  if (!cameraGalleryModal) return;
  document.body.classList.remove("modal-open");
  cameraGalleryModal.classList.remove(CSS_CLASSES.VISIBLE);
  setTimeout(
    () => cameraGalleryModal.classList.add(CSS_CLASSES.HIDDEN),
    MODAL_TRANSITION_DURATION
  );
}

function _handleOutsideClick(event) {
  if (
    cameraGalleryModal?.classList.contains(CSS_CLASSES.VISIBLE) &&
    !modalContentElement?.contains(event.target)
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

// Funcions de progrés OCR - ara utilitzen el nou sistema React
function _updateOcrProgress(percent, statusText) {
  if (!ocrFeedback) {
    ocrFeedback = getOCRFeedbackManager();
  }
  ocrFeedback.update(percent, statusText);
}

function _hideOcrProgress() {
  // El nou sistema es tanca automàticament
  // No cal fer res aquí
}

async function _resizeImage(file) {
  try {
    const img = await createImageBitmap(file);
    const { width: originalWidth, height: originalHeight } = img;
    if (Math.max(originalWidth, originalHeight) <= IMAGE_MAX_DIMENSION) {
      img.close();
      return file;
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
    if (!ctx) throw new Error("No contexto 2D.");
    ctx.drawImage(img, 0, 0, width, height);
    img.close();
    return new Promise((resolve) =>
      canvas.toBlob(resolve, IMAGE_TYPE, IMAGE_QUALITY)
    );
  } catch (error) {
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
    if (!ctx) throw new Error("No contexto 2D.");

    try {
      // Neteja EXIF per privacitat (elimina metadades sensibles com GPS)
      ctx.drawImage(img, 0, 0, img.width, img.height);
    } catch (drawError) {
      // Si falla drawImage inicial, mostra missatge simple i continua
      if (drawError.message && drawError.message.includes("detached")) {
        throw new Error("Error al procesar la imagen. Inténtalo de nuevo.");
      }
      throw drawError;
    }

    img.close();

    // Aplica filtres per millorar OCR sense preservar metadades originals
    ctx.filter = "grayscale(100%) contrast(180%) brightness(110%)";
    try {
      ctx.drawImage(canvas, 0, 0);
    } catch (filterDrawError) {
      // Fallback sense filtres si falla aplicant-los
      console.warn("OCR: Fallback sense filtres:", filterDrawError);
    }

    return new Promise((resolve) =>
      canvas.toBlob(resolve, IMAGE_TYPE, IMAGE_QUALITY)
    );
  } catch (error) {
    // Missatges d'error més amigables per l'usuari
    if (error.message.includes("procesar la imagen")) {
      showToast(error.message, "error");
    } else if (error.message.includes("detached")) {
      showToast(
        "La imagen no se puede procesar. Inténtalo con otra foto.",
        "error"
      );
    } else {
      showToast("Error al procesar la imagen. Inténtalo de nuevo.", "error");
    }
    throw error;
  }
}

function _safeSetFieldValue(fieldId, value, fieldName) {
  const element = document.getElementById(fieldId);
  if (element) {
    element.value = value;

    const inputEvent = new Event("input", {
      bubbles: true,
      cancelable: true,
    });
    element.dispatchEvent(inputEvent);
  }
}

function _processAndFillForm(ocrText) {
  if (!ocrText || !ocrText.trim()) {
    showToast("No se reconoció texto.", "warning");
    return;
  }

  const currentServiceIndex = getCurrentServiceIndex();
  const currentMode = getModeForService(currentServiceIndex) || "3.6";
  const suffix = `-${currentServiceIndex + 1}`;
  let filledFields = {};

  const lines = ocrText.split("\n");
  const processedText = ocrText.toLowerCase().replace(/ +/g, " ");

  Object.values(OCR_PATTERNS).forEach((pattern) => {
    if (
      (currentMode === "3.11" || currentMode === "3.22") &&
      pattern.id === "destinationTime"
    )
      return;

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

  if (
    !filledFields.endTime &&
    (filledFields.originTime || filledFields.destinationTime)
  ) {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${hh}:${mm}`;
    const fieldId = `end-time${suffix}`;

    _safeSetFieldValue(fieldId, currentTime, "Hora Final (Actual)");

    const endTimeElement = document.getElementById(fieldId);
    if (endTimeElement) {
      endTimeElement.classList.add("input-warning");
      endTimeElement.addEventListener(
        "focus",
        () => endTimeElement.classList.remove("input-warning"),
        { once: true }
      );
    }
  }

  const filledCount = Object.keys(filledFields).length;
  if (filledCount > 0) {
    const filledLabels = Object.values(filledFields).map(
      (pattern) => pattern.label
    );
    showToast(`Campos actualizados: ${filledLabels.join(", ")}.`, "success");
  } else {
    showToast("No se encontraron horas relevantes.", "info");
  }
}

export function initCameraOcr() {
  if (isInitialized) return;

  cameraGalleryModal = document.getElementById(DOM_SELECTORS.CAMERA_MODAL);
  modalContentElement = cameraGalleryModal?.querySelector(
    DOM_SELECTORS.MODAL_CONTENT
  );
  optionCameraBtn = document.getElementById(DOM_SELECTORS.OPTION_CAMERA);
  optionGalleryBtn = document.getElementById(DOM_SELECTORS.OPTION_GALLERY);
  cameraInput = document.getElementById(DOM_SELECTORS.CAMERA_INPUT);

  if (
    !cameraGalleryModal ||
    !optionCameraBtn ||
    !optionGalleryBtn ||
    !cameraInput
  )
    return;

  const scanButtons = document.querySelectorAll(DOM_SELECTORS.OCR_SCAN_BTN);
  scanButtons.forEach((button) =>
    button.addEventListener("click", _openCameraModal)
  );

  optionCameraBtn.addEventListener("click", _triggerCameraCapture);
  optionGalleryBtn.addEventListener("click", _triggerGallerySelection);
  cameraInput.addEventListener("change", _handleFileChange);
  document.addEventListener("click", _handleOutsideClick);
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      cameraGalleryModal?.classList.contains(CSS_CLASSES.VISIBLE)
    )
      _closeCameraModal();
  });

  isInitialized = true;
}

function _scrollToBottom() {
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth",
  });
}

async function _handleFileChange(event) {
  if (isProcessing) {
    showToast("Proceso OCR ya en marcha.", "warning");
    return;
  }
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Selecciona una imagen.", "error");
    if (cameraInput) cameraInput.value = "";
    return;
  }

  // Validació de mida d'imatge per prevenció de malware
  const maxSizeBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    showToast(
      `La imagen es demasiado grande (máx. ${MAX_IMAGE_SIZE_MB} MB).`,
      "error"
    );
    if (cameraInput) cameraInput.value = "";
    return;
  }

  isProcessing = true;
  setControlsDisabled(true);

  // Inicia el nou sistema de feedback OCR amb la imatge
  if (!ocrFeedback) {
    ocrFeedback = getOCRFeedbackManager();
  }
  ocrFeedback.start(file);
  _updateOcrProgress(0, "Preparant imatge...");

  _scrollToBottom();

  let worker = null;

  try {
    _updateOcrProgress(2, "Analitzant imatge...");
    let imageBlob = await _resizeImage(file);

    _updateOcrProgress(15, "Eliminant metadades...");
    imageBlob = await _preprocessImage(imageBlob);

    _updateOcrProgress(30, "Millorant la imatge...");
    await new Promise((resolve) => setTimeout(resolve, 100)); // Petit delay visual

    _updateOcrProgress(40, "Carregant motor OCR...");

    // Carrega Tesseract dinàmicament sols quan s'usi
    if (!tesseractScriptLoaded) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        applyCspNonce(script);
        script.src =
          "https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.min.js";
        script.onload = () => {
          tesseractScriptLoaded = true;
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    _updateOcrProgress(60, "Carregant model d'idioma...");

    worker = await Tesseract.createWorker(OCR_LANGUAGE, TESSERACT_ENGINE_MODE, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          const percent = Math.max(70, Math.floor(m.progress * 100 * 0.3 + 70));
          _updateOcrProgress(
            percent,
            `Reconeixent text ${Math.floor(m.progress * 100)}%...`
          );
        } else if (m.status === "loading language model") {
          _updateOcrProgress(70, "Carregant model d'idioma...");
        }
      },
    });

    _updateOcrProgress(80, "Configurant OCR...");

    await worker.setParameters(TESSERACT_PARAMS);

    _updateOcrProgress(85, "Iniciant reconeixement...");

    const {
      data: { text: ocrText },
    } = await worker.recognize(imageBlob);

    // Marca el procés com a completat amb èxit
    ocrFeedback.complete("✓ Text reconegut correctament");

    _processAndFillForm(ocrText);
  } catch (error) {
    // Missatges d'error simples i amigables per l'usuari
    let userFriendlyMessage = "Error en escanejar. Torna-ho a provar.";
    if (error.message && error.message.includes("detached")) {
      userFriendlyMessage =
        "Error en processar la imatge. Prova amb una altra foto.";
    } else if (error.message && error.message.includes("recognition")) {
      userFriendlyMessage =
        "No s'ha pogut llegir el text. Assegura't que la imatge sigui clara.";
    }
    showToast(userFriendlyMessage, "error");

    // Marca el procés com a error
    ocrFeedback.error(userFriendlyMessage);
  } finally {
    if (worker) await worker.terminate();
    if (cameraInput) cameraInput.value = "";
    _hideOcrProgress();
    setControlsDisabled(false);
    isProcessing = false;
  }
}
