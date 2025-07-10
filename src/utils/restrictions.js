/**
 * @file restrictions.js
 * @description Aplica restriccions d'entrada en temps real.
 * @module inputRestrictions
 */

import { showToast } from "../ui/toast.js";

// --- Constants ---
const SELECTORS = {
  SERVICE_NUMBER_INPUT: ".service-number",
};
const ERROR_MESSAGES = {
  DIGITS_ONLY: "Solo se permiten dígitos (0-9) en el número de servicio.",
};

// --- Helper: Debounce per toast ---
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
const debouncedToast = debounce(showToast, 300); // Evita spam

// --- Funcions Públiques ---

/**
 * Configura restriccions per números de servei.
 * @export
 */
export function setupServiceNumberRestrictions() {
  const serviceNumberInputs = document.querySelectorAll(
    SELECTORS.SERVICE_NUMBER_INPUT
  );

  if (!serviceNumberInputs.length) {
    console.warn("Restrictions: No s'han trobat inputs '.service-number'.");
    return;
  }

  serviceNumberInputs.forEach((inputElement) => {
    if (inputElement.dataset.restrictionsSetup === "true") return;
    inputElement.dataset.restrictionsSetup = "true";

    inputElement.addEventListener("keypress", (event) => {
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
        debouncedToast(ERROR_MESSAGES.DIGITS_ONLY, "warning");
      }
    });

    inputElement.addEventListener("paste", (event) => {
      try {
        const pastedData = (
          event.clipboardData || window.clipboardData
        )?.getData("text");
        if (pastedData && !/^\d*$/.test(pastedData)) {
          // Permet buides
          event.preventDefault();
          debouncedToast(ERROR_MESSAGES.DIGITS_ONLY, "warning");
        }
      } catch (error) {
        console.error("Error processant 'paste':", error);
        event.preventDefault();
      }
    });
  });
}
