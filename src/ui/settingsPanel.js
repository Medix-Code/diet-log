/**
 * @file settingsPanel.js
 * @description Gestiona panell d'ajustos.
 * @module settingsPanel
 */

const DOM_IDS = {
  SETTINGS_BTN: "settings",
  SETTINGS_PANEL: "settings-panel",
};
const CSS_CLASSES = {
  PANEL_VISIBLE: "visible",
  BUTTON_OPEN: "open",
};

// --- Variables ---
let settingsBtnElement = null;
let settingsPanelElement = null;
let isPanelInitialized = false;

// --- Funcions Privades ---

function _toggleSettingsPanel(event) {
  event.stopPropagation();
  const isVisible = settingsPanelElement.classList.toggle(
    CSS_CLASSES.PANEL_VISIBLE
  );
  settingsBtnElement.classList.toggle(CSS_CLASSES.BUTTON_OPEN, isVisible);
  settingsBtnElement.setAttribute("aria-expanded", isVisible);
  if (isVisible) settingsPanelElement.querySelector("button")?.focus();
}

function _closePanelIfClickOutside(event) {
  if (
    settingsPanelElement.classList.contains(CSS_CLASSES.PANEL_VISIBLE) &&
    !settingsPanelElement.contains(event.target) &&
    !settingsBtnElement.contains(event.target)
  ) {
    _closePanel();
  }
}

function _closePanelOnEscape(event) {
  if (
    event.key === "Escape" &&
    settingsPanelElement.classList.contains(CSS_CLASSES.PANEL_VISIBLE)
  ) {
    _closePanel();
    settingsBtnElement.focus();
  }
}

function _closePanel() {
  settingsPanelElement.classList.remove(CSS_CLASSES.PANEL_VISIBLE);
  settingsBtnElement.classList.remove(CSS_CLASSES.BUTTON_OPEN);
  settingsBtnElement.setAttribute("aria-expanded", "false");
}

// --- Funcions Públiques ---

/**
 * Inicialitza panell.
 * @export
 */
export function initSettingsPanel() {
  if (isPanelInitialized) return;

  settingsBtnElement = document.getElementById(DOM_IDS.SETTINGS_BTN);
  settingsPanelElement = document.getElementById(DOM_IDS.SETTINGS_PANEL);

  if (!settingsBtnElement || !settingsPanelElement) return;

  settingsBtnElement.addEventListener("click", _toggleSettingsPanel);
  document.addEventListener("click", _closePanelIfClickOutside);
  document.addEventListener("keydown", _closePanelOnEscape);

  settingsPanelElement.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", _closePanel);
  });

  isPanelInitialized = true;
}
