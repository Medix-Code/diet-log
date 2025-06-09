/**
 * @file restrictions.js
 * @description Aplica restriccions d'entrada en temps real a certs camps del formulari.
 * @module inputRestrictions
 */

import { showToast } from "../ui/toast.js"; // Assegura't de tenir la ruta correcta

// --- Constants ---
const SELECTORS = {
  SERVICE_NUMBER_INPUT: ".service-number", // Selector per als inputs de número de servei
};
const ERROR_MESSAGES = {
  DIGITS_ONLY: "Solo se permiten dígitos (0-9) en el número de servicio.",
};

// --- Funcions Públiques ---

/**
 * Configura les restriccions per als inputs de número de servei,
 * permetent només l'entrada de dígits.
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
    // Evita afegir listeners múltiples si la funció es crida més d'un cop
    if (inputElement.dataset.restrictionsSetup === "true") return;
    inputElement.dataset.restrictionsSetup = "true";

    // Keypress: Permet només dígits (i tecles de control com Backspace, Fletxes)
    inputElement.addEventListener("keypress", (event) => {
      // Permet tecles de control (Backspace, Tab, Enter, Fletxes, etc.) en diferents navegadors
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
      // Comprova si la tecla premuda NO és un dígit
      if (!/\d/.test(event.key)) {
        event.preventDefault(); // Bloqueja la introducció del caràcter
        // Mostra el toast només un cop per evitar molestar
        // Podria implementar-se amb un debounce o un flag temporal
        showToast(ERROR_MESSAGES.DIGITS_ONLY, "warning"); // Canviat a 'warning' potser?
      }
    });

    // Paste: Comprova si el text enganxat conté només dígits
    inputElement.addEventListener("paste", (event) => {
      try {
        const pastedData = (
          event.clipboardData || window.clipboardData
        )?.getData("text");
        if (pastedData && !/^\d+$/.test(pastedData)) {
          event.preventDefault(); // Bloqueja l'enganxat
          showToast(ERROR_MESSAGES.DIGITS_ONLY, "warning");
        }
      } catch (error) {
        console.error("Error processant l'event 'paste':", error);
        event.preventDefault(); // Bloqueja per seguretat si hi ha error
      }
    });

    // Input: Podria ser útil per netejar caràcters invàlids si fallen keypress/paste
    // inputElement.addEventListener('input', (event) => {
    //    event.target.value = event.target.value.replace(/\D/g, '');
    // });
  });

  console.log("Restriccions per a números de servei configurades.");
}
