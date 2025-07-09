// ────────────────────────────────────────────────────────────
//  Pastilla flotant que indica l’estat de guardat
// ────────────────────────────────────────────────────────────
const PILL_ID = "save-pill";
const TEXT_SEL = ".pill-text";

const CSS = {
  VISIBLE: "visible",
  HAS_CHANGES: "has-changes",
  SAVING: "saving",
  HAS_SAVED: "has-saved",
  ERROR: "error",
};

let pillEl, textEl, hideTimer;
let isDirty = false; // <── nou flag “hi ha canvis”

/* Helpers ──────────────────────────────────────────────── */
function getEls() {
  if (!pillEl) {
    pillEl = document.getElementById(PILL_ID);
    textEl = pillEl?.querySelector(TEXT_SEL);
  }
}

function setState(msg, cssClass) {
  getEls();
  if (!pillEl || !textEl) return;

  clearTimeout(hideTimer);
  pillEl.className = `save-pill ${cssClass} ${CSS.VISIBLE}`;
  textEl.textContent = msg;
}

/* API pública ──────────────────────────────────────────── */
export function indicateUnsaved() {
  isDirty = true;
  setState("Cambios sin guardar", CSS.HAS_CHANGES);
}

export function indicateSaving() {
  setState("Guardando…", CSS.SAVING);
}

export function indicateSaved() {
  isDirty = false;
  setState("Guardado", CSS.HAS_SAVED);
  hideTimer = setTimeout(hideIndicator, 2000);
}

export function indicateSaveError(msg = "No se pudo guardar") {
  setState(msg, CSS.ERROR);
  hideTimer = setTimeout(hideIndicator, 4000);
}

export function hideIndicator() {
  getEls();
  if (isDirty) return; // Encara hi ha canvis → no l’amaguem
  pillEl?.classList.remove(CSS.VISIBLE);
}
