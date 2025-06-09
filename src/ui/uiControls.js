// Arxiu: src/ui/uiControls.js

const SELECTORS = {
  SERVICE_BUTTONS: ".service-button:not(.active-square)",
  OPTIONS_BTN: "#options-toggle",
  TABS: ".tab:not(.active)",
};

const CSS_CLASS_DISABLED = "disabled-control";

/**
 * Deshabilita els controls principals de la UI que no s'haurien d'utilitzar
 * durant una operació llarga com l'OCR.
 * @param {boolean} disable - True per deshabilitar, false per habilitar.
 */
export function setControlsDisabled(disable = true) {
  const elementsToDisable = document.querySelectorAll(
    Object.values(SELECTORS).join(", ")
  );

  elementsToDisable.forEach((el) => {
    el.classList.toggle(CSS_CLASS_DISABLED, disable);
    // L'estil 'pointer-events: none;' es gestionarà al CSS
  });
}
