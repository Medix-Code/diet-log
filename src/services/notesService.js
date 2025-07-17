/**
 * @file notesService.js
 * @description Configura la funcionalitat del botó per afegir notes al servei actualment seleccionat,
 *              incloent un límit i comptador de caràcters.
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
const NOTES_TEXTAREA_ID = "notes-textarea";
const NOTES_SAVE_ID = "notes-save";
const NOTES_CANCEL_ID = "notes-cancel";
const NOTES_COUNTER_ID = "notes-char-counter"; // Constant per a l'ID del comptador

// --- Variables del mòdul per gestionar els elements i listeners ---
let notesModal, notesTextarea, notesSave, notesCancel, notesCounter;
let currentSaveHandler = null; // Per al listener del botó de guardar
let currentInputHandler = null; // Per al listener del comptador de caràcters

// --- Funció Principal ---

/**
 * Configura el botó "Afegir Notes" per al servei seleccionat.
 * @export
 */
export function setupNotesSelectedService() {
  notesTitle = document.getElementById(NOTES_TITLE_ID);
  if (!notesModal || !notesTitle) {
    console.warn(`Notes Service: Botó amb ID '${NOTES_BUTTON_ID}' no trobat.`);
    return;
  }

  // Obtenim tots els elements del DOM una sola vegada
  notesModal = document.getElementById(NOTES_MODAL_ID);
  notesTextarea = document.getElementById(NOTES_TEXTAREA_ID);
  notesSave = document.getElementById(NOTES_SAVE_ID);
  notesCancel = document.getElementById(NOTES_CANCEL_ID);
  notesCounter = document.getElementById(NOTES_COUNTER_ID); // Obtenim el comptador

  // Comprovem que tots els elements existeixen
  if (
    !notesModal ||
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

  // Afegim el listener de cancel·lar només una vegada, ja que sempre fa el mateix
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

  // 1. Omplim el textarea amb la nota correcta
  notesTitle.textContent = `Notas del Servicio ${serviceIndex + 1}`;

  // 2. Funció per actualitzar el comptador de caràcters
  const updateCounter = () => {
    const currentLength = notesTextarea.value.length;
    const maxLength = notesTextarea.maxLength; // Llegeix l'atribut maxlength="200" de l'HTML
    notesCounter.textContent = `${currentLength} / ${maxLength}`;
  };

  // Actualitzem el comptador al moment d'obrir el modal
  updateCounter();

  // 3. Definim i afegim el listener per a l'escriptura (input)
  currentInputHandler = () => {
    updateCounter();
  };
  notesTextarea.addEventListener("input", currentInputHandler);

  // 4. Definim i afegim el listener per al botó de guardar
  currentSaveHandler = () => {
    serviceNotes[serviceIndex] = notesTextarea.value.trim();
    closeNotesModal();
    showToast("Notes guardades.", "success");
    revalidateFormState();
  };
  notesSave.addEventListener("click", currentSaveHandler);

  // 5. Mostrem el modal i posem el focus
  notesModal.style.display = "block";
  document.body.classList.add("modal-open");
  notesTextarea.focus();
}

/**
 * Tanca el modal de notes i neteja els listeners per evitar acumulacions.
 */
function closeNotesModal() {
  if (!notesModal) return;

  // >> PAS CLAU: Eliminem els listeners per evitar que s'acumulin <<
  if (currentSaveHandler) {
    notesSave.removeEventListener("click", currentSaveHandler);
    currentSaveHandler = null; // Resetejem la variable
  }
  if (currentInputHandler) {
    notesTextarea.removeEventListener("input", currentInputHandler);
    currentInputHandler = null; // Resetejem la variable
  }

  // Amaguem el modal
  notesModal.style.display = "none";
  document.body.classList.remove("modal-open");
}
