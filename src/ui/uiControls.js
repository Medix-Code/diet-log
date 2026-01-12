// Arxiu: src/ui/uiControls.js
/**
 * @module uiControls
 * @description Gestiona l'estat deshabilitat dels controls principals de la UI.
 */

const SELECTORS = {
  SERVICE_BUTTONS: ".service-button:not(.active-square)",
  OPTIONS_BTN: "#options-toggle",
  TABS: ".tab:not(.active)",
};

const CSS_CLASS_DISABLED = "disabled-control";

/**
 * Deshabilita o habilita els controls principals.
 * @param {boolean} [disable=true] - True per deshabilitar, false per habilitar.
 * @export
 */
export function setControlsDisabled(disable = true) {
  const elementsToToggle = document.querySelectorAll(
    Object.values(SELECTORS).join(", ")
  );

  elementsToToggle.forEach((el) => {
    if (!el) return; // Edge case: element no existent
    el.classList.toggle(CSS_CLASS_DISABLED, disable);
    el.setAttribute("aria-disabled", disable ? "true" : "false"); // Accessibilitat
    el.disabled = disable; // Per inputs/buttons
  });
}
