/**
 * @file ocrFeedbackBridge.js
 * @description Pont entre JavaScript vanilla (cameraOcr) i React (OCRFeedback)
 *
 * Permet que el codi JavaScript vanilla controli un component React d'estat
 * per mostrar la vista prèvia de la imatge i el progrés d'OCR en temps real.
 *
 * Ús:
 * ```js
 * import { createOCRFeedbackManager } from './ocrFeedbackBridge.js';
 *
 * const ocrFeedback = createOCRFeedbackManager();
 *
 * ocrFeedback.start(imageFile);
 * ocrFeedback.update(50, 'Processant...');
 * ocrFeedback.complete('Fet!');
 * ```
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { OCRFeedback } from "../components/OCRFeedback.js";

const DEFAULT_PROCESSING_TEXT = "Reconociendo texto";
const STATUS_FALLBACKS = {
  done: "✓ Texto reconocido correctamente",
  warning: "Revisa la información detectada",
  error: "Error al escanear. Imagen no válida",
};

/**
 * Neteja missatges de status per pantalla (sense percentatges ni punts infinits).
 */
const sanitizeStatusMessage = (text, fallback = DEFAULT_PROCESSING_TEXT) => {
  if (!text) return fallback;
  const withoutPercent = text.replace(/\d{1,3}%/g, "");
  const withoutDots = withoutPercent.replace(/\.\.+$/g, "");
  const normalized = withoutDots
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n");
  return normalized || fallback;
};

/**
 * Crea un gestor de feedback OCR que fa de pont entre JavaScript vanilla i React
 * @param {string} containerId - ID de l'element contenidor on es renderitza l'overlay
 * @returns {Object} Objecte gestor amb mètodes de control (start, update, complete, error, reset, ...)
 */
export function createOCRFeedbackManager(containerId = "ocr-feedback-root") {
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    document.body.appendChild(container);
  }

  let root = null;

  // Timer intern per auto-tancar en 'error' / 'done' sense toasts
  let _autoCloseTimer = null;

  // Estat intern (controlat pel bridge; el component és purament presentacional)
  let state = {
    imageUrl: null,
    isProcessing: false,
    progress: 0,
    status: "idle", // 'idle' | 'processing' | 'done' | 'warning' | 'error'
    statusText: DEFAULT_PROCESSING_TEXT,
  };

  /**
   * Renderitza el component React amb l'estat actual.
   */
  const render = () => {
    if (!root) {
      root = ReactDOM.createRoot(container);
    }
    root.render(
      <OCRFeedback
        imageUrl={state.imageUrl}
        isProcessing={state.isProcessing}
        progress={state.progress}
        status={state.status}
        statusText={state.statusText}
        onClose={() => manager.reset()}
      />
    );
  };

  /**
   * Esborra i desarma qualsevol timer intern d'auto-tancament.
   */
  const _clearAutoClose = () => {
    if (_autoCloseTimer) {
      clearTimeout(_autoCloseTimer);
      _autoCloseTimer = null;
    }
  };

  /**
   * Objecte gestor públic.
   */
  const manager = {
    /**
     * Inicia el procés OCR i mostra la vista prèvia de la imatge.
     * @param {File|Blob|string} imageFile
     */
    start(imageFile) {
      _clearAutoClose();

      if (state.imageUrl && state.imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(state.imageUrl);
      }

      if (imageFile instanceof File || imageFile instanceof Blob) {
        state.imageUrl = URL.createObjectURL(imageFile);
      } else if (typeof imageFile === "string") {
        state.imageUrl = imageFile;
      } else {
        state.imageUrl = null;
      }

      state.isProcessing = true;
      state.progress = 0;
      state.status = "processing";
      state.statusText = DEFAULT_PROCESSING_TEXT;
      render();
    },

    /**
     * Actualitza progrés i (opcionalment) missatge.
     * @param {number} progress 0..100
     * @param {string|null} message
     * @param {'info'|'success'|'warning'|'error'} type
     */
    update(progress, message = null, type = "info") {
      _clearAutoClose();

      state.progress = Math.min(100, Math.max(0, progress));
      const sanitizedMessage =
        message !== null ? sanitizeStatusMessage(message) : null;

      if (type === "error") {
        state.status = "error";
        state.statusText =
          sanitizedMessage || STATUS_FALLBACKS.error || DEFAULT_PROCESSING_TEXT;
        state.isProcessing = false;
        // Mostrem la barra “plena” i auto-tanquem després
        state.progress = Math.max(state.progress, 100);
        render();

        _autoCloseTimer = setTimeout(() => {
          manager.reset();
          window.dispatchEvent(
            new CustomEvent("ocr:closed", { detail: { reason: "error" } })
          );
        }, 1000);
        return;
      }

      if (type === "warning") {
        state.status = "warning";
        state.statusText = sanitizedMessage || state.statusText;
        state.isProcessing = true;
        render();
        return;
      }

      if (type === "success") {
        // Alias de complete() amb missatge
        manager.complete(sanitizedMessage || STATUS_FALLBACKS.done, "done");
        return;
      }

      // 'info' (per defecte)
      state.status = "processing";
      if (sanitizedMessage) {
        state.statusText = sanitizedMessage;
      } else if (!state.statusText) {
        state.statusText = DEFAULT_PROCESSING_TEXT;
      }
      state.isProcessing = true;
      render();
    },

    /**
     * Afegeix un missatge sense canviar el percentatge (conserva estat).
     * @param {string} message
     * @param {'info'|'success'|'warning'|'error'} type
     */
    addMessage(message, type = "info") {
      if (type === "error") {
        manager.error(message);
        return;
      }
      if (type === "success") {
        manager.complete(message || STATUS_FALLBACKS.done, "done");
        return;
      }
      state.status = type === "warning" ? "warning" : "processing";
      state.statusText = sanitizeStatusMessage(message);
      state.isProcessing = true;
      render();
    },

    /**
     * Marca el procés com completat i auto-tanca després de 2.5s.
     * @param {string|null} message
     * @param {'done'|'warning'|'error'} status
     */
    complete(message = null, status = "done") {
      _clearAutoClose();

      state.progress = 100;
      const normalizedStatus = ["done", "warning", "error"].includes(status)
        ? status
        : "done";
      state.status = normalizedStatus;

      const fallbackMessage =
        STATUS_FALLBACKS[normalizedStatus] || STATUS_FALLBACKS.done;
      state.statusText = sanitizeStatusMessage(message, fallbackMessage);
      state.isProcessing = false;
      render();

      _autoCloseTimer = setTimeout(() => {
        manager.reset();
        window.dispatchEvent(
          new CustomEvent("ocr:closed", { detail: { reason: "done" } })
        );
      }, 2500);
    },

    /**
     * Marca el procés com a fallat i auto-tanca en ~1s (sense toasts).
     * @param {string} message
     */
    error(message = "No se reconoció texto") {
      _clearAutoClose();

      state.status = "error";
      state.statusText = sanitizeStatusMessage(message, STATUS_FALLBACKS.error);
      state.isProcessing = false;
      state.progress = 100; // Ens assegurem que la barra arribi al final
      render();

      _autoCloseTimer = setTimeout(() => {
        manager.reset();
        window.dispatchEvent(
          new CustomEvent("ocr:closed", { detail: { reason: "error" } })
        );
      }, 1000);
    },

    /**
     * Reinicia l’overlay i neteja recursos (inclosa la blob URL).
     */
    reset() {
      _clearAutoClose();

      if (state.imageUrl && state.imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(state.imageUrl);
      }
      state.imageUrl = null;
      state.isProcessing = false;
      state.progress = 0;
      state.status = "idle";
      state.statusText = DEFAULT_PROCESSING_TEXT;

      render();
    },

    /**
     * Estat actual (per debugging).
     * @returns {{imageUrl:string|null,isProcessing:boolean,progress:number,status:string,statusText:string}}
     */
    getState() {
      return { ...state };
    },

    /**
     * Indica si hi ha un procés OCR en marxa.
     * @returns {boolean}
     */
    isProcessing() {
      return state.isProcessing;
    },
  };

  return manager;
}

/**
 * Patró Singleton — una sola instància per a tota l'aplicació.
 */
let _globalOCRManager = null;

/**
 * Obté o crea el gestor global de feedback OCR.
 * @returns {ReturnType<createOCRFeedbackManager>}
 */
export function getOCRFeedbackManager() {
  if (!_globalOCRManager) {
    _globalOCRManager = createOCRFeedbackManager();
  }
  return _globalOCRManager;
}

/**
 * Destrueix el gestor global de feedback OCR (neteja i anul·la la referència).
 */
export function destroyOCRFeedbackManager() {
  if (_globalOCRManager) {
    _globalOCRManager.reset();
    _globalOCRManager = null;
  }
}
