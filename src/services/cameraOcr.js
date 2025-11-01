// Mòdul per gestionar OCR amb càmera o galeria

import {
  getCurrentServiceIndex,
  getModeForService,
} from "../services/servicesPanelManager.js";
import { setControlsDisabled } from "../ui/uiControls.js";
import { getOCRFeedbackManager } from "../utils/ocrFeedbackBridge.js";
import { showToast } from "../ui/toast.js";
import { logger } from "../utils/logger.js";
import {
  resizeImage,
  preprocessImage,
} from "./cameraOcr/imageProcessing.js";
import { loadExternalScript } from "../utils/secureScriptLoader.js";
import RateLimiter from "../utils/rateLimiter.js";
import { validateOCRResult } from "../utils/inputSanitizer.js";

// --- Constants ---
const OCR_LANGUAGE = "spa";
const TESSERACT_ENGINE_MODE = 1;
const TESSERACT_CHAR_WHITELIST =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:/-ÀÉÍÓÚÈÒÀÜÏÇÑ";
const MAX_IMAGE_SIZE_MB = 10; // Límit de mida d'imatge per prevenció de malware
const MIN_OCR_INTERVAL_MS = 1000;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const IMAGE_SIGNATURES = [
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  {
    type: "image/png",
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
  {
    type: "image/webp",
    bytes: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
  },
];
const MODAL_TRANSITION_DURATION = 300;
const PROGRESS_HIDE_DELAY = 1000;
const OCR_SEARCH_WINDOW = 200;
const TESSERACT_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/tesseract.js@6/dist/tesseract.min.js";
const TESSERACT_SCRIPT_INTEGRITY =
  "sha384-r1ru3tcf6FhnCFR4B7pIFG+BhFF9LlFtz/P1y4pblWn3AGs9y3lBx5SKLNf4+rED";

// Paràmetres d'inicialització (només es poden passar durant la creació del worker)
const INIT_ONLY_PARAMS = {
  load_system_dawg: "0",
  load_freq_dawg: "0",
};

// Paràmetres runtime (es poden modificar amb setParameters)
const TESSERACT_PARAMS = {
  tessedit_char_whitelist: TESSERACT_CHAR_WHITELIST,
  tessedit_pageseg_mode: 6,
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
    lineKeywordRegex: /movilizaci|mobilitzat|desplaza/i,
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
let currentProgress = 0; // Seguiment del progrés actual per evitar que baixi
let lastOcrProcessAt = 0;
const log = logger.withScope("CameraOCR");

// Rate Limiter per OCR (10 scans per minut màx)
const ocrRateLimiter = new RateLimiter(10, 60000, 'escanejat OCR');

// --- Funcions ---
function _matchesSignature(bytes, signature) {
  if (!bytes || bytes.length < signature.length) return false;
  return signature.every(
    (expected, index) =>
      expected === null || bytes[index] === expected
  );
}

async function _isAllowedImageFile(file) {
  if (!file) return false;

  if (ALLOWED_IMAGE_TYPES.has(file.type?.toLowerCase())) {
    return true;
  }

  try {
    const headerBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    return IMAGE_SIGNATURES.some((signature) =>
      _matchesSignature(headerBytes, signature.bytes)
    );
  } catch (error) {
    log.warn("No s'ha pogut validar la signatura del fitxer:", error);
    return false;
  }
}

function _normalizeTime(timeStr) {
  if (!timeStr) return "";
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
  document.body.style.setProperty("pointer-events", "none");
  cameraGalleryModal.style.setProperty("pointer-events", "auto");
  modalContentElement.style.setProperty("pointer-events", "auto");

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
  document.body.style.removeProperty("pointer-events");
  cameraGalleryModal.style.removeProperty("pointer-events");
  if (modalContentElement) {
    modalContentElement.style.removeProperty("pointer-events");
  }

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

// Genera el text de la llista de camps
function _generateFieldsListText(fieldsStatus) {
  const fields = Object.entries(fieldsStatus).filter(([_, info]) => !info.skip);
  const detected = fields.filter(([_, info]) => info.detected).length;
  const total = fields.length;
  return `${detected}/${total} campos detectados`;
}

// Funcions de progrés OCR - ara utilitzen el nou sistema React
function _updateOcrProgress(percent, statusText) {
  if (!ocrFeedback) {
    ocrFeedback = getOCRFeedbackManager();
  }
  if (percent > currentProgress) {
    currentProgress = percent;
  }
  const normalizedStatus =
    currentProgress >= 100
      ? statusText || "Texto reconocido correctamente"
      : "Reconociendo texto...";
  ocrFeedback.update(currentProgress, normalizedStatus);
}

function _hideOcrProgress() {
  currentProgress = 0;
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

function _processAndFillForm(ocrText, updateFieldsCallback = null) {
  if (!ocrText || !ocrText.trim()) {
    return { hasData: false, allFieldsStatus: [] };
  }

  // Validació de seguretat del resultat OCR
  const ocrValidation = validateOCRResult(ocrText);
  if (!ocrValidation.valid) {
    log.warn('Resultat OCR invàlid:', ocrValidation.reason);
    showToast(`Error de validació: ${ocrValidation.reason}`, 'error');
    return { hasData: false, allFieldsStatus: [] };
  }

  const currentServiceIndex = getCurrentServiceIndex();
  const currentMode = getModeForService(currentServiceIndex) || "3.6";
  const suffix = `-${currentServiceIndex + 1}`;
  const filledFields = {};

  const allFieldsStatus = {
    originTime: {
      label: "Hora activación",
      detected: false,
    },
    destinationTime: {
      label: "Hora destino",
      detected: false,
      skip: currentMode === "3.11" || currentMode === "3.22",
    },
    endTime: {
      label: "Hora final",
      detected: false,
    },
  };

  if (updateFieldsCallback) {
    updateFieldsCallback(allFieldsStatus);
  }

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

        if (allFieldsStatus[pattern.id]) {
          allFieldsStatus[pattern.id].detected = true;
          if (updateFieldsCallback) {
            updateFieldsCallback(allFieldsStatus);
          }
        }
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

  return {
    hasData: filledCount > 0,
    count: filledCount,
    fields: filledFields,
    allFieldsStatus,
  };
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
  if (isProcessing) return;

  const file = event.target.files?.[0];
  if (!file) return;

  // Comprovació de Rate Limiting
  if (!ocrRateLimiter.canMakeRequest()) {
    const remaining = ocrRateLimiter.getRemainingRequests();
    showToast(
      `Has superat el límit d'escaneigs. Espera uns segons abans de tornar-ho a intentar. (${remaining} disponibles)`,
      "warning"
    );
    if (cameraInput) cameraInput.value = "";
    return;
  }

  if (Date.now() - lastOcrProcessAt < MIN_OCR_INTERVAL_MS) {
    showToast("OCR massa freqüent. Espera un segon abans de reintentar.", "warning");
    if (cameraInput) cameraInput.value = "";
    return;
  }

  if (!(await _isAllowedImageFile(file))) {
    showToast("Format d'imatge no suportat. Usa PNG, JPG o WEBP.", "error");
    if (cameraInput) cameraInput.value = "";
    return;
  }

  const maxSizeBytes = MAX_IMAGE_SIZE_MB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    showToast(
      `Imatge massa gran. El màxim permès és ${MAX_IMAGE_SIZE_MB}MB.`,
      "error"
    );
    if (cameraInput) cameraInput.value = "";
    return;
  }

  isProcessing = true;
  setControlsDisabled(true);
  currentProgress = 0;

  if (!ocrFeedback) ocrFeedback = getOCRFeedbackManager();
  ocrFeedback.start(file);
  _updateOcrProgress(0);
  _scrollToBottom();
  lastOcrProcessAt = Date.now();

  let worker = null;

  try {
    _updateOcrProgress(5);
    let imageBlob = await resizeImage(file);

    _updateOcrProgress(20);
    imageBlob = await preprocessImage(imageBlob);

    _updateOcrProgress(35);
    await new Promise((r) => setTimeout(r, 100));

    _updateOcrProgress(45);

    if (!tesseractScriptLoaded) {
      _updateOcrProgress(50);
      await loadExternalScript({
        src: TESSERACT_SCRIPT_URL,
        integrity: TESSERACT_SCRIPT_INTEGRITY,
      });
      tesseractScriptLoaded = true;
    }

    _updateOcrProgress(60);

    worker = await Tesseract.createWorker(OCR_LANGUAGE, TESSERACT_ENGINE_MODE, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          const percent = Math.max(
            85,
            Math.floor(m.progress * 100 * 0.15 + 85)
          );
          _updateOcrProgress(percent);
        } else if (m.status === "loading language model") {
          _updateOcrProgress(65);
        }
      },
      init: INIT_ONLY_PARAMS,
    });

    _updateOcrProgress(75);
    await worker.setParameters(TESSERACT_PARAMS);
    _updateOcrProgress(80);

    const {
      data: { text: ocrText },
    } = await worker.recognize(imageBlob);

    const updateFieldsCallback = (fieldsStatus) => {
      const statusMessage = _generateFieldsListText(fieldsStatus);
      ocrFeedback.update(95, statusMessage);
    };

    const ocrResult = _processAndFillForm(ocrText, updateFieldsCallback);

    if (ocrResult.hasData) {
      const message = _generateFieldsListText(ocrResult.allFieldsStatus);
      ocrFeedback.complete(message, "done");
    } else {
      // Sense text detectat → mostra TOAST d'error i espera abans de tancar
      showToast("Error al escanear. Imagen no válida", "error");
      ocrFeedback?.reset?.();
      // Espera 3 segons perquè es llegeixi el TOAST abans de tancar modal
      setTimeout(() => _closeCameraModal(), 1000);
    }
  } catch (error) {
    log.error("Error durant el processament OCR:", error);
    // Error inesperat → mostra TOAST d'error i tanquem modal suaument
    showToast("Error al escanear. Imagen no válida", "error");
    ocrFeedback?.reset?.();
    // Espera 3 segons perquè es llegeixi el TOAST abans de tancar modal
    setTimeout(() => {
      log.debug("Tancant modal OCR després de timeout");
      _closeCameraModal();
    }, 3000);
  } finally {
    try {
      if (worker) await worker.terminate();
    } catch {}
    if (cameraInput) cameraInput.value = "";
    _hideOcrProgress();
    setControlsDisabled(false);
    isProcessing = false;
  }
}

export {};
