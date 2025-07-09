// src/ui/saveIndicator.js
// ────────────────────────────────────────────────────────────
// Controla la “pastilla” flotant que indica l’estat de guardat
// ────────────────────────────────────────────────────────────

const PILL_ID = "save-pill";
const TEXT_SEL = ".pill-text";

const CSS = {
  VISIBLE: "visible",
  HAS_CHANGES: "has-changes",
  SAVING: "saving",
  HAS_SAVED: "has-saved",
  ERROR: "error", // (opcional) si vols estat d’error
};

let pillEl, textEl, hideTimer;

/* Helpers ──────────────────────────────────────────────── */
function getEls() {
  if (!pillEl) {
    pillEl = document.getElementById(PILL_ID);
    textEl = pillEl?.querySelector(TEXT_SEL);
  }
}

function setState(message, cssClass) {
  getEls();
  if (!pillEl || !textEl) return; // seguretat

  clearTimeout(hideTimer); // netegem temporitzador anterior
  pillEl.className = `save-pill ${cssClass} ${CSS.VISIBLE}`;
  textEl.textContent = message;
}

/* ───── API pública (nous noms) ───── */
export function indicateUnsaved() {
  setState("Cambios sin guardar", CSS.HAS_CHANGES);
}

export function indicateSaving() {
  setState("Guardando…", CSS.SAVING);
}

export function indicateSaved() {
  setState("Guardado", CSS.HAS_SAVED);
  hideTimer = setTimeout(hideIndicator, 2000);
}

export function indicateSaveError(msg = "No se pudo guardar") {
  setState(msg, CSS.ERROR);
  hideTimer = setTimeout(hideIndicator, 4000);
}

export function hideIndicator() {
  getEls();
  pillEl?.classList.remove(CSS.VISIBLE);
}
