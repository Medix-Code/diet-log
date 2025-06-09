/**
 * @file clearService.js
 * @description Configura la funcionalitat del botó per netejar
 *              els camps del servei actualment seleccionat.
 * @module clearService
 */

// Importacions de Serveis
import {
  getCurrentServiceIndex,
  clearServiceFields,
} from "../services/servicesPanelManager.js";
import {
  removeErrorClassesFromService, // <-- NOM CORREGIT IMPORTAT
  checkIfFormChanged,
} from "../services/formService.js";

// --- Constants ---
const CLEAR_BUTTON_ID = "clear-selected-service";
const SERVICE_CONTAINER_SELECTOR = ".service";
const BASE_BUTTON_CLASS = "clear-selected-btn"; // Classe base del botó
// Classes de color per servei (podrien venir de config o servicesPanelManager si és més centralitzat)
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
  // Obtenim els elements de servei cada vegada per si canvien dinàmicament,
  // o podríem assumir que són estàtics si fos el cas.
  const allServiceElements = document.querySelectorAll(
    SERVICE_CONTAINER_SELECTOR
  );

  if (!clearButton) {
    console.warn(`Clear Service: Botó amb ID '${CLEAR_BUTTON_ID}' no trobat.`);
    return;
  }
  if (!allServiceElements.length) {
    console.warn(
      `Clear Service: No s'han trobat elements amb selector '${SERVICE_CONTAINER_SELECTOR}'.`
    );
    // Podríem desactivar el botó aquí si no hi ha serveis
    clearButton.disabled = true;
    clearButton.classList.add("disabled-button"); // O una classe específica
    return;
  }

  // --- Gestió de l'estil del botó ---
  // Funció per actualitzar l'estil segons l'índex
  const updateButtonStyle = (index) => {
    // Elimina classes de color anteriors
    clearButton.classList.remove(...SERVICE_COLOR_CLASSES);
    // Afegeix la classe base i la classe de color actual
    const colorClass = SERVICE_COLOR_CLASSES[index] || ""; // Fallback per si l'índex és invàlid
    clearButton.className = `${BASE_BUTTON_CLASS} ${colorClass}`.trim();
  };

  // Actualitza l'estil inicialment
  updateButtonStyle(getCurrentServiceIndex());

  // TODO: Si l'índex del servei pot canviar dinàmicament (p.ex., amb navegació per tabs/botons),
  // caldria un mecanisme per detectar aquest canvi (p.ex., un event personalitzat,
  // o que servicesPanelManager cridi una funció aquí) per actualitzar l'estil del botó.
  // Per ara, assumim que l'estil inicial és suficient o que es gestiona externament.

  // --- Listener del clic ---
  clearButton.addEventListener("click", () => {
    const currentIndex = getCurrentServiceIndex();
    // Tornem a obtenir els elements per si han canviat des de la inicialització
    const currentServiceElements = document.querySelectorAll(
      SERVICE_CONTAINER_SELECTOR
    );

    if (currentIndex >= 0 && currentIndex < currentServiceElements.length) {
      const activeServiceElement = currentServiceElements[currentIndex];

      // 1. Neteja els camps del servei (lògica a servicesPanelManager)
      clearServiceFields(activeServiceElement);

      // 2. Neteja les classes d'error del servei (lògica a formService)
      removeErrorClassesFromService(activeServiceElement); // <-- NOM CORREGIT A LA CRIDA

      // 3. Comprova si el formulari general ha canviat (per actualitzar botó 'Guardar')
      checkIfFormChanged();

      console.log(`Servei ${currentIndex + 1} netejat.`);
      // Opcional: Podria ser útil moure el focus al primer camp del servei netejat
      activeServiceElement.querySelector("input, textarea, select")?.focus();
    } else {
      console.warn(
        `Clear Service: Índex de servei invàlid (${currentIndex}) o element no trobat.`
      );
    }
  });

  console.log("Funcionalitat 'Netejar Servei Seleccionat' configurada.");
}
