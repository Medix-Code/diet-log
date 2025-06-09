/**
 * @file settingsPanel.js
 * @description Gestiona la interactivitat del panell desplegable d'ajustos/opcions.
 * @module settingsPanel
 */

// --- Constants ---
const DOM_IDS = {
  SETTINGS_BTN: "settings", // Botó que obre/tanca (hamburguesa)
  SETTINGS_PANEL: "settings-panel", // El panell que es mostra/oculta
};
const CSS_CLASSES = {
  PANEL_VISIBLE: "visible", // Classe per mostrar el panell
  BUTTON_OPEN: "open", // Classe per canviar l'estil del botó (hamburguesa a creu)
};
const SELECTORS = {
  PANEL_BUTTONS: `#${DOM_IDS.SETTINGS_PANEL} button`, // Botons dins del panell
};

// --- Variables / Cache ---
let settingsBtnElement = null;
let settingsPanelElement = null;
let isPanelInitialized = false;

// --- Funcions Privades ---

/** Mostra o oculta el panell d'ajustos. */
function _toggleSettingsPanel(event) {
  if (!settingsPanelElement || !settingsBtnElement) return;
  event.stopPropagation(); // Evita que _closePanelIfClickOutside es tanqui immediatament
  const isVisible = settingsPanelElement.classList.toggle(
    CSS_CLASSES.PANEL_VISIBLE
  );
  settingsBtnElement.classList.toggle(CSS_CLASSES.BUTTON_OPEN, isVisible);
  settingsBtnElement.setAttribute("aria-expanded", isVisible);
  // if (isVisible) settingsPanelElement.querySelector('button')?.focus(); // Focus al primer botó
}

/** Tanca el panell si es clica fora d'ell o del seu botó d'obertura. */
function _closePanelIfClickOutside(event) {
  if (
    settingsPanelElement?.classList.contains(CSS_CLASSES.PANEL_VISIBLE) &&
    !settingsPanelElement.contains(event.target) &&
    !settingsBtnElement?.contains(event.target)
  ) {
    _closePanel();
  }
}

/** Tanca el panell si es prem la tecla Escape. */
function _closePanelOnEscape(event) {
  if (
    event.key === "Escape" &&
    settingsPanelElement?.classList.contains(CSS_CLASSES.PANEL_VISIBLE)
  ) {
    _closePanel();
    settingsBtnElement?.focus(); // Retorna focus al botó
  }
}

/** Tanca el panell (usat internament per Escape, Clic Fora, Clic Botó). */
function _closePanel() {
  if (!settingsPanelElement || !settingsBtnElement) return;
  settingsPanelElement.classList.remove(CSS_CLASSES.PANEL_VISIBLE);
  settingsBtnElement.classList.remove(CSS_CLASSES.BUTTON_OPEN);
  settingsBtnElement.setAttribute("aria-expanded", "false");
}

// --- Funcions Públiques ---

/**
 * Inicialitza la funcionalitat per mostrar/ocultar el panell d'ajustos.
 * @export
 */
export function initSettingsPanel() {
  if (isPanelInitialized) return;

  settingsBtnElement = document.getElementById(DOM_IDS.SETTINGS_BTN);
  settingsPanelElement = document.getElementById(DOM_IDS.SETTINGS_PANEL);

  if (!settingsBtnElement || !settingsPanelElement) {
    console.warn("Settings Panel: Botó o panell no trobats.");
    return;
  }

  settingsBtnElement.addEventListener("click", _toggleSettingsPanel);
  document.addEventListener("click", _closePanelIfClickOutside);
  document.addEventListener("keydown", _closePanelOnEscape);

  // Tanca el panell si es clica un botó dins seu
  settingsPanelElement.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", _closePanel); // No cal event.stopPropagation aquí
  });

  isPanelInitialized = true;
  console.log("Panell d'ajustos inicialitzat.");
}
