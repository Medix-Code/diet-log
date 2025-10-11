/**
 * @file ocrFeedbackBridge.js
 * @description Pont entre JavaScript vanilla (cameraOcr) i React (OCRFeedback)
 *
 * Permet que el codi JavaScript vanilla llegat controli components React
 * sense necessitat de reescriure-ho tot en React.
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

/**
 * Crea un gestor de feedback OCR que fa de pont entre JavaScript vanilla i React
 * @param {string} containerId - ID de l'element contenidor
 * @returns {Object} Objecte gestor amb mètodes de control
 */
export function createOCRFeedbackManager(containerId = "ocr-feedback-root") {
  let container = document.getElementById(containerId);

  // Crea el contenidor si no existeix
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    document.body.appendChild(container);
  }

  let root = null;
  let state = {
    imageUrl: null,
    isProcessing: false,
    messages: [],
    progress: 0,
  };

  /**
   * Renderitza el component React amb l'estat actual
   */
  const render = () => {
    if (!root) {
      root = ReactDOM.createRoot(container);
    }

    root.render(
      <OCRFeedback
        imageUrl={state.imageUrl}
        isProcessing={state.isProcessing}
        messages={state.messages}
        progress={state.progress}
        onClose={() => manager.reset()}
      />
    );
  };

  /**
   * Objecte gestor amb mètodes de control
   */
  const manager = {
    /**
     * Inicia el procés OCR i mostra la vista prèvia de la imatge
     * @param {File|Blob|string} imageFile - Fitxer d'imatge o URL
     */
    start(imageFile) {
      if (imageFile instanceof File || imageFile instanceof Blob) {
        state.imageUrl = URL.createObjectURL(imageFile);
      } else if (typeof imageFile === "string") {
        state.imageUrl = imageFile;
      }
      state.isProcessing = true;
      state.messages = [];
      state.progress = 0;
      render();
    },

    /**
     * Actualitza el progrés i opcionalment afegeix un missatge
     * @param {number} progress - Percentatge de progrés (0-100)
     * @param {string} message - Missatge opcional a mostrar
     * @param {string} type - Tipus de missatge ('info', 'success', 'warning', 'error')
     */
    update(progress, message = null, type = "info") {
      state.progress = Math.min(100, Math.max(0, progress));
      if (message) {
        state.messages = [
          ...state.messages,
          {
            text: message,
            type: type,
            timestamp: Date.now(),
          },
        ];
      }
      render();
    },

    /**
     * Afegeix un missatge sense actualitzar el progrés
     * @param {string} message - Text del missatge
     * @param {string} type - Tipus de missatge ('info', 'success', 'warning', 'error')
     */
    addMessage(message, type = "info") {
      state.messages = [
        ...state.messages,
        {
          text: message,
          type: type,
          timestamp: Date.now(),
        },
      ];
      render();
    },

    /**
     * Marca el procés OCR com a completat
     * @param {string} message - Missatge d'èxit
     */
    complete(message = "Procés completat") {
      state.progress = 100;
      state.messages = [
        ...state.messages,
        {
          text: message,
          type: "success",
          timestamp: Date.now(),
        },
      ];
      state.isProcessing = false;
      render();

      // Tanca automàticament després de 3 segons
      setTimeout(() => {
        manager.reset();
      }, 3000);
    },

    /**
     * Marca el procés OCR com a fallat
     * @param {string} message - Missatge d'error
     */
    error(message = "Error en el procés") {
      state.messages = [
        ...state.messages,
        {
          text: message,
          type: "error",
          timestamp: Date.now(),
        },
      ];
      state.isProcessing = false;
      render();
    },

    /**
     * Afegeix un missatge d'advertència
     * @param {string} message - Missatge d'advertència
     */
    warning(message) {
      state.messages = [
        ...state.messages,
        {
          text: message,
          type: "warning",
          timestamp: Date.now(),
        },
      ];
      render();
    },

    /**
     * Reinicia l'estat del feedback OCR i neteja recursos
     */
    reset() {
      // Neteja la URL del blob per prevenir fuites de memòria
      if (state.imageUrl && state.imageUrl.startsWith("blob:")) {
        URL.revokeObjectURL(state.imageUrl);
      }

      state = {
        imageUrl: null,
        isProcessing: false,
        messages: [],
        progress: 0,
      };

      render();
    },

    /**
     * Obté l'estat actual (per depuració)
     * @returns {Object} Estat actual
     */
    getState() {
      return { ...state };
    },

    /**
     * Comprova si l'OCR està processant actualment
     * @returns {boolean}
     */
    isProcessing() {
      return state.isProcessing;
    },
  };

  return manager;
}

/**
 * Patró Singleton - una sola instància per a tota l'aplicació
 */
let _globalOCRManager = null;

/**
 * Obté o crea el gestor global de feedback OCR
 * @returns {Object} Gestor de feedback OCR
 */
export function getOCRFeedbackManager() {
  if (!_globalOCRManager) {
    _globalOCRManager = createOCRFeedbackManager();
  }
  return _globalOCRManager;
}

/**
 * Destrueix el gestor global de feedback OCR
 */
export function destroyOCRFeedbackManager() {
  if (_globalOCRManager) {
    _globalOCRManager.reset();
    _globalOCRManager = null;
  }
}
