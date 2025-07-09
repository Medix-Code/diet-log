// A src/ui/saveIndicator.js

const INDICATOR_ID = "save-status-indicator";
const TEXT_ID = "save-status-indicator-text";

const CSS_VISIBLE = "visible";
const CSS_CLASSES = {
  HAS_CHANGES: "has-changes",
  SAVING: "saving",
  HAS_SAVED: "has-saved",
};

let indicatorEl, textEl, successTimer;

function _getElements() {
  if (!indicatorEl) {
    indicatorEl = document.getElementById(INDICATOR_ID);
    textEl = document.getElementById(TEXT_ID);
  }
}

function _updateState(text, cssClass) {
  _getElements();
  if (!indicatorEl || !textEl) return;

  clearTimeout(successTimer);
  indicatorEl.className = `save-status-indicator ${cssClass} ${CSS_VISIBLE}`;
  textEl.textContent = text;
}

export function showHasChanges() {
  _updateState("Canvis pendents", CSS_CLASSES.HAS_CHANGES);
}

export function showSavingIndicator() {
  _updateState("Guardant...", CSS_CLASSES.SAVING);
}

export function showSavedSuccess() {
  _updateState("Guardat", CSS_CLASSES.HAS_SAVED);
  successTimer = setTimeout(hideIndicator, 2000);
}

export function hideIndicator() {
  _getElements();
  indicatorEl?.classList.remove(CSS_VISIBLE);
}
