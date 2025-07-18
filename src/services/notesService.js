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

// --- Funció Principal ---

/**
 * Configura el botó "Afegir Notes" per al servei seleccionat.
 * @export
 */
export function setupNotesSelectedService() {
  const notesButton = document.getElementById(NOTES_BUTTON_ID);
  if (!notesButton) {
    console.warn(`Notes Service: Botó amb ID '${NOTES_BUTTON_ID}' no trobat.`);
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
    console.error(
      "Notes Service: Un o més elements del modal de notes no s'han trobat."
    );
    return;
  }

  // Listener per obrir el modal
  notesButton.addEventListener("click", () => {
    const currentIndex = getCurrentServiceIndex();
    openNotesModal(currentIndex);
  });

  // Afegim el listener de cancel·lar només una vegada
  notesCancel.addEventListener("click", closeNotesModal);

  console.log("Funcionalitat 'Afegir Notes' configurada.");
}

// --- Funcions Auxiliars ---

/**
 * Obre el modal de notes, configura els listeners i el comptador.
 * @param {number} serviceIndex - L'índex del servei actiu.
 */
function openNotesModal(serviceIndex) {
  if (!notesModal) return;

  notesTitle.textContent = `S${serviceIndex + 1}: Observaciones`;

  notesTextarea.value = serviceNotes[serviceIndex] || "";

  const updateCounter = () => {
    const currentLength = notesTextarea.value.length;
    const maxLength = notesTextarea.maxLength;
    notesCounter.textContent = `${currentLength} / ${maxLength}`;
  };
  updateCounter();

  currentInputHandler = () => updateCounter();
  notesTextarea.addEventListener("input", currentInputHandler);

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
  }, 0);
}

/**
 * Tanca el modal de notes i neteja els listeners per evitar acumulacions.
 */
function closeNotesModal() {
  if (!notesModal) return;

  // Eliminem els listeners per evitar que s'acumulin
  if (currentSaveHandler) {
    notesSave.removeEventListener("click", currentSaveHandler);
    currentSaveHandler = null;
  }
  if (currentInputHandler) {
    notesTextarea.removeEventListener("input", currentInputHandler);
    currentInputHandler = null;
  }

  // Amaguem el modal i desbloquegem el body
  notesModal.style.display = "none";
  document.body.classList.remove("modal-open");
}
