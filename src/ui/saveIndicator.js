// saveIndicator.js
//-----------------------------------------------------------
// Pastilla flotant d’estat de guardat amb maneig robust i accessibilitat.
//-----------------------------------------------------------

/**
 * @module saveIndicator
 * @description Gestiona una píndola flotant per indicar estats de guardat (Google-Docs style).
 */

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

let pillEl = null;
let textEl = null;
let hideTimer = null;
let unsavedTimer = null;

let isDirty = false;

// Helpers ──────────────────────────────────────────────────
/**
 * Obté els elements DOM de la píndola, amb cacheig i validació.
 * @throws {Error} Si els elements no existeixen.
 */
function getEls() {
  if (!pillEl) {
    pillEl = document.getElementById(PILL_ID);
    textEl = pillEl?.querySelector(TEXT_SEL);
    if (!pillEl || !textEl) {
      throw new Error("Elements de la píndola no trobats al DOM.");
    }
    // Millora accessibilitat: Afegir ARIA per estats dinàmics
    pillEl.setAttribute("role", "status");
    pillEl.setAttribute("aria-live", "polite");
  }
  return { pillEl, textEl };
}

/**
 * Mostra la píndola amb text i classe CSS específica.
 * @param {string} txt - Text a mostrar.
 * @param {string} [cssClass] - Classe CSS addicional.
 */
function showPill(txt, cssClass) {
  try {
    const { pillEl, textEl } = getEls();
    pillEl.classList.add(CSS.VISIBLE);
    pillEl.classList.remove(
      CSS.HAS_CHANGES,
      CSS.SAVING,
      CSS.HAS_SAVED,
      CSS.ERROR
    );
    if (cssClass) pillEl.classList.add(cssClass);
    // Sanititzar text per seguretat (encara que sigui intern)
    textEl.textContent = txt.replace(/[<>&]/g, ""); // Bàsic escaping
  } catch (err) {
    console.warn("[saveIndicator] Error mostrant píndola:", err);
  }
}

// API pública ──────────────────────────────────────────────
/**
 * Indica canvis sense guardar amb delay.
 * @param {number} [delay=DELAY_UNSAVED] - Delay en ms.
 */
export function indicateUnsaved(delay = DELAY_UNSAVED) {
  clearTimeout(unsavedTimer);
  unsavedTimer = setTimeout(() => {
    isDirty = true;
    showPill("Cambios sin guardar", CSS.HAS_CHANGES);
  }, delay);
}

/**
 * Indica que s'està guardant, amb missatge personalitzat.
 * @param {string} [msg="Guardando…"] - Missatge a mostrar.
 */
export function indicateSaving(msg = "Guardando…") {
  clearTimeout(unsavedTimer);
  showPill(msg, CSS.SAVING);
}

/**
 * Indica que s'ha guardat correctament.
 */
export function indicateSaved() {
  clearTimeout(unsavedTimer);
  isDirty = false;
  showPill("Guardado", CSS.HAS_SAVED);

  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideIndicator, MIN_VISIBLE);
}

/**
 * Indica error en el guardat.
 * @param {string} [msg="No se pudo guardar"] - Missatge d'error.
 */
export function indicateSaveError(msg = "No se pudo guardar") {
  clearTimeout(unsavedTimer);
  showPill(msg, CSS.ERROR);

  clearTimeout(hideTimer);
  hideTimer = setTimeout(hideIndicator, MIN_VISIBLE * 2);
}

/**
 * Amaga la píndola.
 * @param {boolean} [force=false] - Força l'amagatge encara que hi hagi canvis pendents.
 */
export function hideIndicator(force = false) {
  try {
    getEls();
    clearTimeout(hideTimer);
    if (isDirty && !force) return;
    pillEl?.classList.remove(CSS.VISIBLE);
    hideTimer = null;
  } catch (err) {
    console.warn("[saveIndicator] Error amagant píndola:", err);
  }
}

/**
 * Restableix l’estat intern i amaga la píndola.
 */
export function resetDirty() {
  isDirty = false;
  clearTimeout(unsavedTimer);
  hideIndicator(true);
}

// Neteja en unload per evitar leaks (escalabilitat)
window.addEventListener("pagehide", () => {
  clearTimeout(hideTimer);
  clearTimeout(unsavedTimer);
});
