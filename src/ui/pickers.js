/**
 * Configuració de date/time pickers natius
 * Abans era "pickers.js"
 */

export function setupDatePickers() {
  const dateInps = document.querySelectorAll('input[type="date"]');
  dateInps.forEach((inp) => {
    if (typeof inp.showPicker === "function") {
      inp.addEventListener("click", () => {
        inp.addEventListener("keydown", (e) => e.preventDefault());
        inp.addEventListener("paste", (e) => e.preventDefault());
        inp.showPicker();
      });
    }
  });
}

export function setupTimePickers() {
  const timeInps = document.querySelectorAll('input[type="time"]');
  timeInps.forEach((inp) => {
    if (typeof inp.showPicker === "function") {
      inp.addEventListener("click", () => {
        inp.showPicker();
      });
    }
  });
}
