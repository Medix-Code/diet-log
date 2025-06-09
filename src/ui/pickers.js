/**
 * @file pickers.js
 * @description Configuració per intentar obrir els date/time pickers natius
 *              en fer clic a l'input corresponent.
 * @module pickers
 */

/** Configura l'obertura de date pickers natius. */
export function setupDatePickers() {
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach((input) => {
    // Evita afegir listeners múltiples
    if (input.dataset.pickerSetup === "true") return;
    input.dataset.pickerSetup = "true";

    if (typeof input.showPicker === "function") {
      // Obre el picker al clic, però permet edició manual
      input.addEventListener("click", (event) => {
        // Si fem clic directament a l'input (no a la icona nativa si n'hi ha)
        // intentem obrir el selector.
        try {
          input.showPicker();
        } catch (e) {
          // L'error pot passar si ja està obert, etc. No és crític.
          // console.warn("No s'ha pogut mostrar el date picker:", e);
        }
      });
    } else {
      console.warn("El navegador no suporta input.showPicker() per a dates.");
    }
  });
  console.log("Date pickers configurats.");
}

/** Configura l'obertura de time pickers natius. */
export function setupTimePickers() {
  const timeInputs = document.querySelectorAll('input[type="time"]');
  timeInputs.forEach((input) => {
    if (input.dataset.pickerSetup === "true") return;
    input.dataset.pickerSetup = "true";

    if (typeof input.showPicker === "function") {
      input.addEventListener("click", () => {
        try {
          input.showPicker();
        } catch (e) {
          // console.warn("No s'ha pogut mostrar el time picker:", e);
        }
      });
    } else {
      console.warn("El navegador no suporta input.showPicker() per a temps.");
    }
  });
  console.log("Time pickers configurats.");
}
