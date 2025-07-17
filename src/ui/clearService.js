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

      clearServiceFields(activeServiceElement);

      removeErrorClassesFromService(activeServiceElement);

      revalidateFormState();

      console.log(`Servei ${currentIndex + 1} netejat.`);
    } else {
      console.warn(
        `Clear Service: Índex de servei invàlid (${currentIndex}) o element no trobat.`
      );
    }
  });

  console.log("Funcionalitat 'Netejar Servei Seleccionat' configurada.");
}
