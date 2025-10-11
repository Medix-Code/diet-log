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
    // Updated regex for better accuracy
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

  // Gestió de pointer-events per evitar bloquejos
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

  // Neteja de pointer-events
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
  // Assegurem que el progrés només pugi, mai baixi
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
  // El nou sistema es tanca automàticament
  // No cal fer res aquí
  currentProgress = 0; // Reset per a la propera vegada
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

function _processAndFillForm(ocrText, updateFieldsCallback = null) {
  if (!ocrText || !ocrText.trim()) {
    showToast("No se reconoció texto.", "warning");
    return false;
  }

  const currentServiceIndex = getCurrentServiceIndex();
  const currentMode = getModeForService(currentServiceIndex) || "3.6";
  const suffix = `-${currentServiceIndex + 1}`;
  const filledFields = {};

  // Inicialitza l'estat de tots els camps
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

  // Mostra l'estat inicial si hi ha callback
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

        // Actualitza l'estat del camp detectat
        if (allFieldsStatus[pattern.id]) {
          allFieldsStatus[pattern.id].detected = true;
          // Notifica el canvi si hi ha callback
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

  // Retorna informació detallada sobre els camps detectats
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

  // Reinicia el seguiment de progrés
  currentProgress = 0;

  // Inicia el nou sistema de feedback OCR amb la imatge
  if (!ocrFeedback) {
    ocrFeedback = getOCRFeedbackManager();
  }
  ocrFeedback.start(file);
  _updateOcrProgress(0);

  _scrollToBottom();

  let worker = null;

  try {
    _updateOcrProgress(5);
    let imageBlob = await _resizeImage(file);

    _updateOcrProgress(20);
    imageBlob = await _preprocessImage(imageBlob);

    _updateOcrProgress(35);
    await new Promise((resolve) => setTimeout(resolve, 100)); // Petit delay visual

    _updateOcrProgress(45);

    // Carrega Tesseract dinàmicament sols quan s'usi
    if (!tesseractScriptLoaded) {
      _updateOcrProgress(50); // Indica que està carregant la llibreria
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

    _updateOcrProgress(60);

    worker = await Tesseract.createWorker(OCR_LANGUAGE, TESSERACT_ENGINE_MODE, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          // Progressió més suau: de 85% a 100%
          const percent = Math.max(
            85,
            Math.floor(m.progress * 100 * 0.15 + 85)
          );
          _updateOcrProgress(percent);
        } else if (m.status === "loading language model") {
          _updateOcrProgress(65);
        }
      },
      init: INIT_ONLY_PARAMS, // Paràmetres d'inicialització (load_system_dawg, load_freq_dawg)
    });

    _updateOcrProgress(75);

    await worker.setParameters(TESSERACT_PARAMS);

    _updateOcrProgress(80);

    const {
      data: { text: ocrText },
    } = await worker.recognize(imageBlob);

    // Funció callback per actualitzar els camps en temps real
    const updateFieldsCallback = (fieldsStatus) => {
      const statusMessage = _generateFieldsListText(fieldsStatus);
      ocrFeedback.update(95, statusMessage);
    };

    const ocrResult = _processAndFillForm(ocrText, updateFieldsCallback);

    // Missatge final segons els camps detectats
    if (ocrResult.hasData) {
      const message = _generateFieldsListText(ocrResult.allFieldsStatus);
      ocrFeedback.complete(message, "done");
    } else {
      const message = _generateFieldsListText(ocrResult.allFieldsStatus);
      ocrFeedback.complete(message, "warning");
    }
  } catch (error) {
    // Missatges d'error simples i amigables per l'usuari
    let userFriendlyMessage = "Error al escanear. Vuelve a intentarlo.";
    if (error.message && error.message.includes("detached")) {
      userFriendlyMessage =
        "Error al procesar la imagen. Prueba con otra foto.";
    } else if (error.message && error.message.includes("recognition")) {
      userFriendlyMessage =
        "No se pudo leer el texto. Asegúrate de que la imagen sea clara.";
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
