/**
 * @file ocrFeedbackBridge.js
 * @description Bridge between vanilla JS (cameraOcr) and React (OCRFeedback)
 *
 * Allows legacy vanilla JavaScript code to control React components
 * without needing to rewrite everything in React.
 *
 * Usage:
 * ```js
 * import { createOCRFeedbackManager } from './ocrFeedbackBridge.js';
 *
 * const ocrFeedback = createOCRFeedbackManager();
 *
 * ocrFeedback.start(imageFile);
 * ocrFeedback.update(50, 'Processing...');
 * ocrFeedback.complete('Done!');
 * ```
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { OCRFeedback } from "../components/OCRFeedback.js";

/**
 * Creates an OCR feedback manager that bridges vanilla JS with React
 * @param {string} containerId - ID of the container element
 * @returns {Object} Manager object with control methods
 */
export function createOCRFeedbackManager(containerId = "ocr-feedback-root") {
  let container = document.getElementById(containerId);

  // Create container if it doesn't exist
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
   * Renders the React component with current state
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
   * Manager object with control methods
   */
  const manager = {
    /**
     * Starts OCR process and shows image preview
     * @param {File|Blob|string} imageFile - Image file or URL
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
     * Updates progress and optionally adds a message
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} message - Optional message to display
     * @param {string} type - Message type ('info', 'success', 'warning', 'error')
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
     * Adds a message without updating progress
     * @param {string} message - Message text
     * @param {string} type - Message type ('info', 'success', 'warning', 'error')
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
     * Marks OCR process as complete
     * @param {string} message - Success message
     */
    complete(message = "Proceso completado") {
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

      // Auto-close after 3 seconds
      setTimeout(() => {
        manager.reset();
      }, 3000);
    },

    /**
     * Marks OCR process as failed
     * @param {string} message - Error message
     */
    error(message = "Error en el proceso") {
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
     * Adds a warning message
     * @param {string} message - Warning message
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
     * Resets the OCR feedback state and cleans up
     */
    reset() {
      // Clean up blob URL to prevent memory leaks
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
     * Gets current state (for debugging)
     * @returns {Object} Current state
     */
    getState() {
      return { ...state };
    },

    /**
     * Checks if OCR is currently processing
     * @returns {boolean}
     */
    isProcessing() {
      return state.isProcessing;
    },
  };

  return manager;
}

/**
 * Singleton pattern - single instance for the entire app
 */
let _globalOCRManager = null;

/**
 * Gets or creates the global OCR feedback manager
 * @returns {Object} OCR feedback manager
 */
export function getOCRFeedbackManager() {
  if (!_globalOCRManager) {
    _globalOCRManager = createOCRFeedbackManager();
  }
  return _globalOCRManager;
}

/**
 * Destroys the global OCR feedback manager
 */
export function destroyOCRFeedbackManager() {
  if (_globalOCRManager) {
    _globalOCRManager.reset();
    _globalOCRManager = null;
  }
}
