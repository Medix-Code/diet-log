/**
 * @file mainButtons.js
 * @description Configuració dels listeners per als botons d'acció principals
 *              ubicats normalment al panell d'ajustos o similar.
 * @module mainButtons
 */

// Importacions de Serveis (funcions que executen els botons)
import { generateAndDownloadPdf } from "../services/pdfService.js";
import { onClickSaveDiet } from "../services/dietService.js";
// Importacions de UI (funcions que obren modals)
import { openDietModal } from "./modals.js"; // Assumint que modals.js exporta openDietModal

// --- Constants ---
const BUTTON_SELECTORS = {
  GENERATE_PDF: ".generate-pdf", // Classe per al botó PDF
  SAVE_DIET: "#save-diet", // ID del botó de desar
  MANAGE_DIETS: "#manage-diets", // ID del botó de gestionar dietes
};

// --- Funcions Públiques / Exportades ---

/**
 * Assigna els event listeners als botons principals d'acció de l'aplicació.
 * @export
 */
export function setupMainButtons() {
  // Botó Generar PDF
  const generatePdfButton = document.querySelector(
    BUTTON_SELECTORS.GENERATE_PDF
  );
  if (generatePdfButton) {
    generatePdfButton.addEventListener("click", generateAndDownloadPdf);
  } else {
    console.warn(
      `Main Buttons: Botó '${BUTTON_SELECTORS.GENERATE_PDF}' no trobat.`
    );
  }

  // Botó Guardar Dieta
  const saveDietButton = document.getElementById(
    BUTTON_SELECTORS.SAVE_DIET.substring(1)
  ); // Treu # per getElementById
  if (saveDietButton) {
    saveDietButton.addEventListener("click", onClickSaveDiet);
  } else {
    console.warn(
      `Main Buttons: Botó '${BUTTON_SELECTORS.SAVE_DIET}' no trobat.`
    );
  }

  // Botó Gestionar Dietes
  const manageDietsButton = document.getElementById(
    BUTTON_SELECTORS.MANAGE_DIETS.substring(1)
  );
  if (manageDietsButton) {
    // Comprovem si la funció openDietModal realment existeix abans d'assignar-la
    if (typeof openDietModal === "function") {
      manageDietsButton.addEventListener("click", openDietModal);
    } else {
      console.error(
        `Main Buttons: La funció 'openDietModal' no està disponible o no s'ha importat correctament des de modals.js.`
      );
    }
  } else {
    console.warn(
      `Main Buttons: Botó '${BUTTON_SELECTORS.MANAGE_DIETS}' no trobat.`
    );
  }

  console.log("Listeners dels botons principals configurats.");
}
