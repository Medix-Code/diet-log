/**
 * @file mainButtons.js
 * @description Configura botons principals.
 * @module mainButtons
 */

import { generateAndDownloadPdf } from "../services/pdfService.js";
import { handleManualSave } from "../services/dietService.js";
import { openDietModal } from "./modals.js";
import { openTrashModal } from "./modals/trashModal.js";

const BUTTON_SELECTORS = {
  GENERATE_PDF: ".generate-pdf",
  SAVE_DIET: "#save-diet",
  MANAGE_DIETS: "#manage-diets",
  TRASH_MODAL: "#open-trash-modal",
};

/**
 * Configura botons.
 * @export
 */
export function setupMainButtons() {
  const generatePdfButton = document.querySelector(
    BUTTON_SELECTORS.GENERATE_PDF
  );
  if (generatePdfButton)
    generatePdfButton.addEventListener("click", generateAndDownloadPdf);

  const saveDietButton = document.getElementById(
    BUTTON_SELECTORS.SAVE_DIET.substring(1)
  );
  if (saveDietButton)
    saveDietButton.addEventListener("click", handleManualSave);

  const manageDietsButton = document.getElementById(
    BUTTON_SELECTORS.MANAGE_DIETS.substring(1)
  );
  if (manageDietsButton && typeof openDietModal === "function") {
    manageDietsButton.addEventListener("click", openDietModal);
  }

  const trashButton = document.getElementById(
    BUTTON_SELECTORS.TRASH_MODAL.substring(1)
  );
  if (trashButton && typeof openTrashModal === "function") {
    trashButton.addEventListener("click", openTrashModal);
  }
}
