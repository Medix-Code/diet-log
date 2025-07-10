/**
 * @file pickers.js
 * @description Configura pickers natius.
 * @module pickers
 */

/**
 * Configura date pickers.
 * @export
 */
export function setupDatePickers() {
  const dateInputs = document.querySelectorAll('input[type="date"]');
  dateInputs.forEach((input) => {
    if (input.dataset.pickerSetup === "true") return;
    input.dataset.pickerSetup = "true";

    if (typeof input.showPicker === "function") {
      input.addEventListener("click", () => {
        try {
          input.showPicker();
        } catch (e) {
          // Silenciòs
        }
      });
    }
  });
}

/**
 * Configura time pickers.
 * @export
 */
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
          // Silenciòs
        }
      });
    }
  });
}
