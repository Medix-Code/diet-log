/**
 * @file clearService.js
 * @description Configura la funcionalitat del botó per netejar
 *              els camps del servei actualment seleccionat.
 * @module clearService
 */
import {
  getCurrentServiceIndex,
  clearServiceFields,
  removeErrorClassesFromService,
} from "../services/servicesPanelManager.js";

import { revalidateFormState } from "../services/formService.js";

const CLEAR_BUTTON_ID = "clear-selected-service";
const SERVICE_CONTAINER_SELECTOR = ".service";
const BASE_BUTTON_CLASS = "clear-selected-btn";
const SERVICE_COLOR_CLASSES = [
  "service-1",
  "service-2",
  "service-3",
  "service-4",
];

/**
 * Configura el botó "Netejar Servei Seleccionat".
 * Afegeix listeners i gestiona l'estil del botó segons el servei actiu.
 * @export
 */
export function setupClearSelectedService() {
  const clearButton = document.getElementById(CLEAR_BUTTON_ID);
  if (!clearButton) {
    console.warn(`Clear Service: Botó amb ID '${CLEAR_BUTTON_ID}' no trobat.`);
    return;
  }

  // --- Listener del clic ---
  clearButton.addEventListener("click", () => {
    const currentIndex = getCurrentServiceIndex();
    const allServiceElements = document.querySelectorAll(
      SERVICE_CONTAINER_SELECTOR
    );

    if (currentIndex >= 0 && currentIndex < allServiceElements.length) {
      const activeServiceElement = allServiceElements[currentIndex];

      // 1. Seleccionem tots els camps que es poden netejar dins del panell actiu
      const fieldsToClear = activeServiceElement.querySelectorAll(
        'input:not([type="button"]):not([type="submit"]), select, textarea'
      );

      // 2. Afegim la classe CSS per iniciar l'animació NOMÉS als camps que tenen contingut
      fieldsToClear.forEach((field) => {
        if (field.value !== "") {
          field.classList.add("field-clearing");
        }
      });

      // 3. Usem un temporitzador per esperar que l'animació acabi abans de netejar realment els camps
      setTimeout(() => {
        // Accions que ja feies abans
        clearServiceFields(activeServiceElement);
        removeErrorClassesFromService(activeServiceElement);
        revalidateFormState();

        // 4. IMPORTANT: Traiem la classe de l'animació perquè pugui tornar a funcionar la propera vegada
        fieldsToClear.forEach((field) => {
          field.classList.remove("field-clearing");
        });

        console.log(`Servei ${currentIndex + 1} netejat amb efecte visual.`);
      }, 600); // Aquest temps ha de coincidir amb la durada de l'animació CSS (0.6s = 600ms)
    } else {
      console.warn(
        `Clear Service: Índex de servei invàlid (${currentIndex}) o element no trobat.`
      );
    }
  });

  console.log("Funcionalitat 'Netejar Servei Seleccionat' configurada.");
}
