/**
 * @file clearService.js
 * @description Configura la funcionalitat del botó per netejar
 *              els camps del servei actualment seleccionat.
 * @module clearService
 */

// --- Importacions de Serveis ---

// Importem des de servicesPanelManager les funcions que gestionen els panells
import {
  getCurrentServiceIndex,
  clearServiceFields,
  removeErrorClassesFromService, // Funció per netejar errors visuals
} from "../services/servicesPanelManager.js";

// Importem des de formService la funció per re-validar l'estat del formulari
import { revalidateFormState } from "../services/formService.js";

// --- Constants ---
const CLEAR_BUTTON_ID = "clear-selected-service";
const SERVICE_CONTAINER_SELECTOR = ".service";
const BASE_BUTTON_CLASS = "clear-selected-btn";
const SERVICE_COLOR_CLASSES = [
  "service-1",
  "service-2",
  "service-3",
  "service-4",
];

// --- Funció Principal ---

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

      // 1. Neteja els valors dels camps del servei.
      clearServiceFields(activeServiceElement);

      // 2. Neteja les classes d'error visuals del servei.
      removeErrorClassesFromService(activeServiceElement);

      // 3. Notifica a formService que torni a avaluar l'estat del formulari.
      // Això activarà el botó "Guardar" i l'indicador de canvis si és necessari.
      revalidateFormState();

      console.log(`Servei ${currentIndex + 1} netejat.`);
      // Movem el focus al primer camp per a una millor UX
      activeServiceElement.querySelector("input, textarea, select")?.focus();
    } else {
      console.warn(
        `Clear Service: Índex de servei invàlid (${currentIndex}) o element no trobat.`
      );
    }
  });

  // La lògica per actualitzar el color del botó ja està gestionada a servicesPanelManager,
  // així que ja no cal duplicar-la aquí. Això simplifica el codi.
  // La funció _updateExternalButtonStyles a servicesPanelManager ja s'encarrega.

  console.log("Funcionalitat 'Netejar Servei Seleccionat' configurada.");
}
