/**
 * @file notesService.js
 * @description Configura la funcionalitat del botó per afegir notes al servei actualment seleccionat,
 *              incloent un límit, comptador de caràcters i correcció de scroll.
 * @module notesService
 */

// --- Importacions ---
import {
  getCurrentServiceIndex,
  serviceNotes,
} from "./servicesPanelManager.js";
import { revalidateFormState } from "./formService.js";
import { showToast } from "../ui/toast.js";

// --- Constants ---
const NOTES_BUTTON_ID = "notes-selected-service";
const NOTES_MODAL_ID = "notes-modal";
const NOTES_TITLE_ID = "notes-title";
const NOTES_TEXTAREA_ID = "notes-textarea";
const NOTES_SAVE_ID = "notes-save";
const NOTES_CANCEL_ID = "notes-cancel";
const NOTES_COUNTER_ID = "notes-char-counter";

// --- Variables del mòdul per gestionar els elements i listeners ---
let notesModal, notesTitle, notesTextarea, notesSave, notesCancel, notesCounter;
let currentSaveHandler = null;
let currentInputHandler = null;
let currentEnterKeyHandler = null;

// --- Funció Principal ---

/**
 * Configura el botó "Afegir Notes" per al servei seleccionat.
 * @export
 */
export function setupNotesSelectedService() {
  const notesButton = document.getElementById(NOTES_BUTTON_ID);
  if (!notesButton) {
    return;
  }

  // Obtenim tots els elements del DOM una sola vegada
  notesModal = document.getElementById(NOTES_MODAL_ID);
  notesTitle = document.getElementById(NOTES_TITLE_ID);
  notesTextarea = document.getElementById(NOTES_TEXTAREA_ID);
  notesSave = document.getElementById(NOTES_SAVE_ID);
  notesCancel = document.getElementById(NOTES_CANCEL_ID);
  notesCounter = document.getElementById(NOTES_COUNTER_ID);

  // Comprovem que tots els elements existeixen
  if (
    !notesModal ||
    !notesTitle ||
    !notesTextarea ||
    !notesSave ||
    !notesCancel ||
    !notesCounter
  ) {
    return;
  }

  notesButton.addEventListener("click", () => {
    const currentIndex = getCurrentServiceIndex();
    openNotesModal(currentIndex);
  });

  notesCancel.addEventListener("click", closeNotesModal);
}

/**
 * Obre el modal de notes, configura els listeners i el comptador.
 * @param {number} serviceIndex - L'índex del servei actiu.
 */
function openNotesModal(serviceIndex) {
  if (!notesModal) return;

  notesTitle.textContent = `S${serviceIndex + 1}: Observaciones`;
  notesTextarea.value = serviceNotes[serviceIndex] || "";
  const maxLength = notesTextarea.maxLength;

  const updateCounterAndStyle = () => {
    const currentLength = notesTextarea.value.length;

    notesCounter.textContent = `${currentLength} / ${maxLength}`;

    notesCounter.classList.remove("warning", "limit");
    notesTextarea.classList.remove("input-warning", "input-error");

    if (currentLength >= maxLength) {
      notesCounter.classList.add("limit");
      notesTextarea.classList.add("input-error");
    } else if (currentLength > maxLength * 0.8) {
      // Més del 80%
      notesCounter.classList.add("warning");
      notesTextarea.classList.add("input-warning");
    }
  };

  updateCounterAndStyle();

  currentInputHandler = () => {
    const currentLength = notesTextarea.value.length;

    if (currentLength > maxLength) {
      notesTextarea.value = notesTextarea.value.slice(0, maxLength);
    }

    updateCounterAndStyle();
  };
  notesTextarea.addEventListener("input", currentInputHandler);

  currentEnterKeyHandler = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      notesTextarea.blur();
    }
  };
  notesTextarea.addEventListener("keydown", currentEnterKeyHandler);

  currentSaveHandler = () => {
    const newNote = notesTextarea.value.trim();
    const oldNote = serviceNotes[serviceIndex] || "";

    if (newNote === oldNote) {
      closeNotesModal();
      return;
    }

    serviceNotes[serviceIndex] = newNote;

    if (newNote) {
      showToast("Observación guardada.", "success");
    } else {
      showToast("Observación eliminada.", "info");
    }

    closeNotesModal();
    revalidateFormState();
  };
  notesSave.addEventListener("click", currentSaveHandler);

  notesModal.style.display = "block";
  document.body.classList.add("modal-open");

  setTimeout(() => {
    notesTextarea.focus({ preventScroll: true });
    notesTextarea.setSelectionRange(
      notesTextarea.value.length,
      notesTextarea.value.length
    );
  }, 0);
}

/**
 * Tanca el modal de notes i neteja els listeners per evitar acumulacions.
 */
function closeNotesModal() {
  if (!notesModal) return;

  if (currentSaveHandler) {
    notesSave.removeEventListener("click", currentSaveHandler);
    currentSaveHandler = null;
  }
  if (currentInputHandler) {
    notesTextarea.removeEventListener("input", currentInputHandler);
    currentInputHandler = null;
  }
  if (currentEnterKeyHandler) {
    notesTextarea.removeEventListener("keydown", currentEnterKeyHandler);
    currentEnterKeyHandler = null;
  }

  // Netejem les classes d'estil en tancar
  notesCounter.classList.remove("warning", "limit");
  notesTextarea.classList.remove("input-warning", "input-error");

  notesModal.style.display = "none";
  document.body.classList.remove("modal-open");
}
