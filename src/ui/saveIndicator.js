// src/ui/saveIndicator.js

const SETTINGS_BTN_ID = "settings";
const CSS_SAVING_CLASS = "saving";
const CSS_HAS_CHANGES_CLASS = "has-changes"; // Opcional

let settingsBtnEl = null;

function _getElements() {
  if (!settingsBtnEl) {
    settingsBtnEl = document.getElementById(SETTINGS_BTN_ID);
  }
}

/**
 * Mostra que hi ha canvis pendents (opcional).
 */
export function showHasChanges() {
  _getElements();
  settingsBtnEl?.classList.remove(CSS_SAVING_CLASS);
  settingsBtnEl?.classList.add(CSS_HAS_CHANGES_CLASS);
}

/**
 * Activa l'animació de "guardant" a la icona.
 */
export function showSavingIndicator() {
  _getElements();
  settingsBtnEl?.classList.remove(CSS_HAS_CHANGES_CLASS);
  settingsBtnEl?.classList.add(CSS_SAVING_CLASS);
}

/**
 * Atura qualsevol animació de l'indicador.
 */
export function hideSavingIndicator() {
  _getElements();
  settingsBtnEl?.classList.remove(CSS_SAVING_CLASS);
  settingsBtnEl?.classList.remove(CSS_HAS_CHANGES_CLASS);
  // Tornem les barres al seu color original (si les hem canviat)
  // Això es pot gestionar millor amb CSS si la classe s'elimina.
}
