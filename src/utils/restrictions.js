/**
 * @file restrictions.js
 * @description Aplica restricciones de entrada en tiempo real.
 * @module inputRestrictions
 */

import { showToast } from "../ui/toast.js";
import { debounce } from "./utils.js";

// --- Constantes ---
import { SELECTORS, MESSAGES, TIMEOUTS } from "../config/constants.js";

const showDebouncedToast = debounce(showToast, TIMEOUTS.DEBOUNCE_TOAST); // Evita spam de notificaciones.

// --- Funciones Internas ---

/**
 * Valida si un texto contiene solo dígitos o está vacío.
 * @param {string} text - Texto a validar.
 * @returns {boolean} - True si es válido, false si no.
 */
function isOnlyDigits(text) {
  return /^\d*$/.test(text);
}

// --- Funciones Públicas ---

/**
 * Configura restricciones para números de servicio.
 * @export
 */
export function setupServiceNumberRestrictions() {
  const serviceNumberInputs = document.querySelectorAll(
    SELECTORS.SERVICE_NUMBER_INPUT
  );

  if (!serviceNumberInputs.length) {
    console.warn(
      "Restrictions: No se han encontrado inputs '.service-number'."
    );
    return;
  }

  serviceNumberInputs.forEach((inputElement) => {
    if (inputElement.dataset.restrictionsSetup === "true") return;
    inputElement.dataset.restrictionsSetup = "true";

    inputElement.addEventListener("keypress", (event) => {
      // Permite teclas de control y especiales.
      if (
        event.key === "Enter" ||
        event.key === "Tab" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.key.length > 1
      ) {
        return;
      }

      if (!/\d/.test(event.key)) {
        event.preventDefault();
        showDebouncedToast(MESSAGES.SERVICE_NUMBER_DIGITS_ONLY, "warning");
      }
    });

    inputElement.addEventListener("paste", (event) => {
      try {
        const pastedData =
          (event.clipboardData || window.clipboardData)?.getData("text") || "";
        if (!isOnlyDigits(pastedData)) {
          event.preventDefault();
          showDebouncedToast(MESSAGES.SERVICE_NUMBER_DIGITS_ONLY, "warning");
        }
      } catch (error) {
        console.error("Error procesando 'paste':", error);
        event.preventDefault();
      }
    });
  });
}
