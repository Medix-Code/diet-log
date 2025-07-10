// saveIndicator.js
//-----------------------------------------------------------
// Pastilla flotant d’estat de guardat
//-----------------------------------------------------------
const PILL_ID = "save-pill";
const TEXT_SEL = ".pill-text";

const CSS = {
  VISIBLE: "visible",
  HAS_CHANGES: "has-changes",
  SAVING: "saving",
  HAS_SAVED: "has-saved",
  ERROR: "error",
};

// Ajustos “Google-Docs style”
const MIN_VISIBLE = 2000; // ✔︎ es manté com a mínim 2 s
const DELAY_UNSAVED = 800; // esperem 0,8 s abans de dir "Cambios sin guardar"

let pillEl, textEl;
let hideTimer, unsavedTimer;
let lastSavedT = 0; // quan s’ha mostrat ✔︎
let isDirty = false;

// Helpers ──────────────────────────────────────────────────
function getEls() {
  if (!pillEl) {
    pillEl = document.getElementById(PILL_ID);
    textEl = pillEl?.querySelector(TEXT_SEL);
  }
}

function showPill(txt, cssClass) {
  getEls();
  if (!pillEl || !textEl) return;

  pillEl.classList.add(CSS.VISIBLE);
  pillEl.classList.remove(
    CSS.HAS_CHANGES,
    CSS.SAVING,
    CSS.HAS_SAVED,
    CSS.ERROR
  );
  if (cssClass) pillEl.classList.add(cssClass);
  textEl.textContent = txt;
}

// API pública ──────────────────────────────────────────────
export function indicateUnsaved(delay = DELAY_UNSAVED) {
  clearTimeout(unsavedTimer);
  unsavedTimer = setTimeout(() => {
    isDirty = true;
    showPill("Cambios sin guardar", CSS.HAS_CHANGES);
  }, delay);
}

export function indicateSaving() {
  clearTimeout(unsavedTimer);
  showPill("Guardando…", CSS.SAVING);
}

export function indicateSaved() {
  clearTimeout(unsavedTimer);
  isDirty = false;
  lastSavedT = Date.now();
  showPill("Guardado", CSS.HAS_SAVED);

  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideIndicator, MIN_VISIBLE);
}

export function indicateSaveError(msg = "No se pudo guardar") {
  clearTimeout(unsavedTimer);
  showPill(msg, CSS.ERROR);

  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideIndicator, MIN_VISIBLE * 2);
}

export function hideIndicator(force = false) {
  getEls();
  clearTimeout(hideTimer);
  if (isDirty && !force) return; // <— canvi
  pillEl?.classList.remove(CSS.VISIBLE);
  hideTimer = null;
}

/**
 * Restableix l’estat intern (isDirty = false) i amaga la píndola.
 * Útil quan l’usuari desfà tots els canvis abans que hàgim tornat a guardar.
 */
export function resetDirty() {
  isDirty = false; // ← netegem el flag intern
  clearTimeout(unsavedTimer);
  hideIndicator(true); // ← l’amaguem forçant-lo
}
