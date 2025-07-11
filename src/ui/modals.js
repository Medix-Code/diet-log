/**
 * @file modals.js
 * @description Gestiona modals amb swipe i undo per eliminació.
 * @module modals
 */

import { loadDietById, deleteDietHandler } from "../services/dietService.js";
import { getDietDisplayInfo, capitalizeFirstLetter } from "../utils/utils.js";
import { getAllDiets } from "../db/indexedDbDietRepository.js";
import { hasPendingChanges } from "../services/formService.js";
import { downloadDietPDF } from "../services/pdfService.js";

// --- Constants ---
const CSS_CLASSES = {
  MODAL_VISIBLE: "visible",
  MODAL_OPEN_BODY: "modal-open",
  HIDDEN: "hidden",
  DIET_ITEM: "diet-item",
  DIET_DATE: "diet-date",
  DIET_ICONS: "diet-icons",
  DIET_DELETE_BTN: "diet-delete",
  DIET_LOAD_BTN: "diet-load",
  LIST_ITEM_BTN: "list-item-btn",
  LIST_ITEM_BTN_LOAD: "list-item-btn--load",
  LIST_ITEM_BTN_DELETE: "list-item-btn--delete",
  DIET_ITEM_SWIPING: "swiping",
  DIET_DELETE_REVEAL: "delete-reveal",
};

const DOM_IDS = {
  DIET_MODAL: "diet-modal",
  DIET_OPTIONS_LIST: "diet-options",
  NO_DIETS_TEXT: "no-diets-text",
  CONFIRM_MODAL: "confirm-modal",
  CONFIRM_MESSAGE: "confirm-message",
  CONFIRM_TITLE: ".modal-title",
  CONFIRM_YES_BTN: "confirm-yes",
  CONFIRM_NO_BTN: "confirm-no",
  ABOUT_MODAL: "about-modal",
  SIGNATURE_MODAL: "signature-modal",
  DOTACIO_MODAL: "dotacio-modal",
  CAMERA_GALLERY_MODAL: "camera-gallery-modal",
};

const SELECTORS = {
  MODAL: ".modal",
  MODAL_CLOSE_BTN: ".close-modal, .close-modal-btn",
  MODAL_TRIGGER: 'a[href^="#"]',
  FOCUSABLE_ELEMENTS:
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
};

const DATA_ATTRIBUTES = {
  DIET_ID: "data-diet-id",
  DIET_DATE: "data-diet-date",
  DIET_TYPE: "data-diet-type",
};

// --- Variables ---
let dietModalElement = null;
let dietOptionsListElement = null;
let noDietsTextElement = null;
let confirmModalElement = null;
let confirmMsgElement = null;
let confirmTitleElement = null;
let confirmYesBtn = null;
let confirmNoBtn = null;
let currentConfirmResolve = null;
let activeModalElement = null;
let previousActiveElement = null;
let currentOutsideClickListener = null;
let currentEscapeKeyListener = null;

// --- Funcions Privades ---

function _openGenericModal(modalElement) {
  if (!modalElement) return;

  if (
    activeModalElement &&
    activeModalElement.id !== modalElement.id &&
    modalElement.id !== DOM_IDS.CONFIRM_MODAL
  ) {
    return;
  }

  if (!activeModalElement) {
    previousActiveElement = document.activeElement;
  }

  activeModalElement = modalElement;
  modalElement.style.display = "block";
  document.body.classList.add(CSS_CLASSES.MODAL_OPEN_BODY);

  if (!currentOutsideClickListener) {
    currentOutsideClickListener = (event) => {
      if (event.target === activeModalElement) {
        if (activeModalElement.id === DOM_IDS.CONFIRM_MODAL) {
          _handleConfirmNo();
        } else {
          _closeGenericModal();
        }
      }
    };
    document.addEventListener("click", currentOutsideClickListener, true);
  }

  if (!currentEscapeKeyListener) {
    currentEscapeKeyListener = (event) => {
      if (event.key === "Escape" && activeModalElement) {
        if (activeModalElement.id === DOM_IDS.CONFIRM_MODAL) {
          _handleConfirmNo();
        } else {
          _closeGenericModal();
        }
      }
    };
    document.addEventListener("keydown", currentEscapeKeyListener, true);
  }

  const firstFocusable = modalElement.querySelector(
    SELECTORS.FOCUSABLE_ELEMENTS
  );
  firstFocusable?.focus();
}

function _closeGenericModal() {
  if (!activeModalElement) return;

  if (currentOutsideClickListener) {
    document.removeEventListener("click", currentOutsideClickListener, true);
    currentOutsideClickListener = null;
  }
  if (currentEscapeKeyListener) {
    document.removeEventListener("keydown", currentEscapeKeyListener, true);
    currentEscapeKeyListener = null;
  }

  activeModalElement.style.display = "none";

  const isConfirmModalClosing = activeModalElement.id === DOM_IDS.CONFIRM_MODAL;

  activeModalElement = null;

  const anotherModalIsOpen = document.querySelector(
    '.modal[style*="display: block"]'
  );
  if (!anotherModalIsOpen) {
    document.body.classList.remove(CSS_CLASSES.MODAL_OPEN_BODY);
  }

  if (!isConfirmModalClosing && previousActiveElement) {
    previousActiveElement.focus();
    previousActiveElement = null;
  } else if (!anotherModalIsOpen) {
    previousActiveElement?.focus();
    previousActiveElement = null;
  }
}

function _formatTimeFromISO(isoTimestamp) {
  if (!isoTimestamp) return "";
  const date = new Date(isoTimestamp);
  if (isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function _createDietListItem(diet) {
  const { ddmmaa, franjaText } = getDietDisplayInfo(diet.date, diet.dietType);
  const creationTime = _formatTimeFromISO(diet.timeStampDiet);

  const dietItem = document.createElement("div");
  dietItem.className = CSS_CLASSES.DIET_ITEM;

  const dietItemContent = document.createElement("div");
  dietItemContent.className = "diet-item-content";

  const dateSpan = document.createElement("span");
  dateSpan.className = CSS_CLASSES.DIET_DATE;
  let displayText = ddmmaa;
  if (creationTime) displayText += ` [${creationTime}]`;
  displayText += ` - ${capitalizeFirstLetter(franjaText)}`;
  dateSpan.textContent = displayText;

  const iconsContainer = document.createElement("div");
  iconsContainer.className = CSS_CLASSES.DIET_ICONS;

  const deleteReveal = document.createElement("div");
  deleteReveal.className = "delete-reveal";
  deleteReveal.innerHTML = `<img src="assets/icons/delete.svg" alt="Eliminar" class="icon">`;

  const loadBtn = document.createElement("button");
  loadBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} ${CSS_CLASSES.LIST_ITEM_BTN_LOAD} ${CSS_CLASSES.DIET_LOAD_BTN}`;
  loadBtn.setAttribute("aria-label", `Cargar dieta ${ddmmaa}`);
  loadBtn.innerHTML = `<img src="assets/icons/upload2.svg" alt="" class="icon"><span class="btn-text visually-hidden">Cargar</span>`;
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_ID, diet.id);
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_DATE, diet.date);
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_TYPE, diet.dietType);

  const downloadBtn = document.createElement("button");
  downloadBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} diet-download`;
  downloadBtn.setAttribute(
    "aria-label",
    `Descarregar PDF de la dieta ${ddmmaa}`
  );
  downloadBtn.innerHTML = `<img src="assets/icons/download_blue.svg" alt="" class="icon"><span class="btn-text visually-hidden">PDF</span>`;
  downloadBtn.setAttribute(DATA_ATTRIBUTES.DIET_ID, diet.id);

  iconsContainer.appendChild(loadBtn);
  iconsContainer.appendChild(downloadBtn);

  dietItemContent.appendChild(dateSpan);
  dietItemContent.appendChild(iconsContainer);

  dietItem.appendChild(dietItemContent);
  dietItem.appendChild(deleteReveal);

  return dietItem;
}

export async function _handleDietListClick(event) {
  const target = event.target;
  const loadButton = target.closest(`.${CSS_CLASSES.DIET_LOAD_BTN}`);
  const downloadButton = target.closest(".diet-download");

  if (loadButton) {
    event.stopPropagation();
    const dietId = loadButton.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    const dietDate = loadButton.getAttribute(DATA_ATTRIBUTES.DIET_DATE);
    const dietType = loadButton.getAttribute(DATA_ATTRIBUTES.DIET_TYPE);
    if (!dietId) return;

    const { ddmmaa, franjaText } = getDietDisplayInfo(dietDate, dietType);

    if (hasPendingChanges()) {
      const confirmed = await showConfirmModal(
        `¿Quieres cargar la dieta de la ${franjaText} del ${ddmmaa}? Los datos no guardados del formulario actual se perderán.`,
        "Cargar dieta"
      );

      if (!confirmed) return;
    }

    try {
      await loadDietById(dietId);
    } catch (error) {
      // Maneig silenciós o toast d'error si cal
    }
  } else if (downloadButton) {
    event.stopPropagation();
    const dietId = downloadButton.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    if (dietId) {
      downloadDietPDF(dietId);
    }
  }
}

// Eliminem _trapConfirmFocus i _cleanupConfirmModalListeners ja que no usem modal per eliminar

// Simplifiquem showConfirmModal per altres usos (no per eliminar dietes)
export function showConfirmModal(message, title = "Confirmar acció") {
  if (!confirmModalElement) return Promise.resolve(false);

  return new Promise((resolve) => {
    currentConfirmResolve = resolve;
    confirmTitleElement.textContent = title;
    confirmMsgElement.textContent = message;

    confirmYesBtn.addEventListener("click", () => resolve(true));
    confirmNoBtn.addEventListener("click", () => resolve(false));

    _openGenericModal(confirmModalElement);

    confirmYesBtn.focus();
  }).finally(() => {
    confirmYesBtn.removeEventListener("click", () => {});
    confirmNoBtn.removeEventListener("click", () => {});
  });
}

export function removeDietItemFromList(dietId) {
  if (!dietOptionsListElement) return;

  const itemToRemove = dietOptionsListElement
    .querySelector(`[data-diet-id="${dietId}"]`)
    ?.closest(".diet-item");
  if (!itemToRemove) return;

  // MILLORA: Anima l'alçada de la llista per una transició suau quan puja
  const currentHeight = dietOptionsListElement.scrollHeight + "px";
  dietOptionsListElement.style.height = currentHeight;

  itemToRemove.remove(); // Remove immediat per tancar el gap

  requestAnimationFrame(() => {
    dietOptionsListElement.style.height =
      dietOptionsListElement.scrollHeight + "px"; // Recalcula i anima a la nova alçada (menor)
  });

  // Actualitza visibilitat immediatament (mostra text si és l'última dieta)
  updateDietListVisibility();
}

export function setupModalGenerics() {
  confirmModalElement = document.getElementById(DOM_IDS.CONFIRM_MODAL);
  if (confirmModalElement) {
    confirmMsgElement = document.getElementById(DOM_IDS.CONFIRM_MESSAGE);
    confirmTitleElement = confirmModalElement.querySelector(
      DOM_IDS.CONFIRM_TITLE
    );
    confirmYesBtn = document.getElementById(DOM_IDS.CONFIRM_YES_BTN);
    confirmNoBtn = document.getElementById(DOM_IDS.CONFIRM_NO_BTN);
  }

  const modalTriggers = document.querySelectorAll(SELECTORS.MODAL_TRIGGER);
  modalTriggers.forEach((trigger) => {
    const modalId = trigger.getAttribute("href")?.substring(1);
    if (!modalId) return;
    const targetModal = document.getElementById(modalId);

    if (targetModal && targetModal.matches(SELECTORS.MODAL)) {
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        _openGenericModal(targetModal);
      });

      const closeButtons = targetModal.querySelectorAll(
        SELECTORS.MODAL_CLOSE_BTN
      );
      closeButtons.forEach((btn) => {
        btn.addEventListener("click", () => _closeGenericModal());
      });
    }
  });
}

export function openDietModal() {
  if (!dietModalElement) {
    dietModalElement = document.getElementById(DOM_IDS.DIET_MODAL);
    dietOptionsListElement = document.getElementById(DOM_IDS.DIET_OPTIONS_LIST);
    noDietsTextElement = document.getElementById(DOM_IDS.NO_DIETS_TEXT);

    const closeDietBtn = document.getElementById("close-diet-modal");
    if (closeDietBtn) {
      closeDietBtn.addEventListener("click", closeDietModal);
    }

    if (dietOptionsListElement) {
      dietOptionsListElement.addEventListener("click", _handleDietListClick);
    }
  }
  if (dietModalElement) {
    _openGenericModal(dietModalElement);
    displayDietOptions();
  }
}

export function closeDietModal() {
  if (activeModalElement && activeModalElement.id === DOM_IDS.DIET_MODAL) {
    _closeGenericModal();
  }
}

export async function displayDietOptions() {
  if (!dietOptionsListElement || !noDietsTextElement) return;

  dietOptionsListElement.innerHTML = "";
  try {
    let savedDiets = await getAllDiets();
    if (savedDiets.length === 0) {
      dietOptionsListElement.classList.add(CSS_CLASSES.HIDDEN);
      noDietsTextElement.classList.remove(CSS_CLASSES.HIDDEN);
      noDietsTextElement.textContent = "No hay dietas guardadas.";
    } else {
      dietOptionsListElement.classList.remove(CSS_CLASSES.HIDDEN);
      noDietsTextElement.classList.add(CSS_CLASSES.HIDDEN);

      savedDiets.sort(
        (a, b) => new Date(b.timeStampDiet) - new Date(a.timeStampDiet)
      );

      savedDiets.forEach((diet, index) => {
        const listItem = _createDietListItem(diet);
        listItem.setAttribute("data-index", index); // MILLORA: Index per posició original
        dietOptionsListElement.appendChild(listItem);
        initSwipeToDelete(listItem, diet.id, diet.date, diet.dietType);
      });
    }
  } catch (error) {
    dietOptionsListElement.classList.add(CSS_CLASSES.HIDDEN);
    noDietsTextElement.classList.remove(CSS_CLASSES.HIDDEN);
    noDietsTextElement.textContent = "Error al cargar las dietas.";
  }
}

// Nova funció auxiliar per actualitzar visibilitat de la llista
function updateDietListVisibility() {
  console.log(
    "Actualitzant visibilitat: children.length =",
    dietOptionsListElement.children.length
  ); // DEPURACIÓ
  if (dietOptionsListElement.children.length === 0) {
    dietOptionsListElement.classList.add(CSS_CLASSES.HIDDEN);
    noDietsTextElement.classList.remove(CSS_CLASSES.HIDDEN);
    noDietsTextElement.textContent = "No hay dietas guardadas.";
  } else {
    dietOptionsListElement.classList.remove(CSS_CLASSES.HIDDEN);
    noDietsTextElement.classList.add(CSS_CLASSES.HIDDEN);
  }
}

function initMouseSwipeToDelete(dietItem, dietId, dietDate, dietType) {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  dietItem.addEventListener("mousedown", (e) => {
    if (e.target.closest("button") || e.target.closest(".diet-icons")) return;
    startX = e.clientX;
    currentX = startX;
    isDragging = false;
  });

  document.addEventListener("mousemove", (e) => {
    currentX = e.clientX;
    const diff = startX - currentX;
    if (diff > 10 && !isDragging) {
      isDragging = true;
      dietItem.classList.add(CSS_CLASSES.DIET_ITEM_SWIPING);
    }
    if (isDragging && diff > 10) {
      dietItem.style.transform = `translateX(-${Math.min(diff, 80)}px)`;
      e.preventDefault();
    }
  });

  document.addEventListener("mouseup", async (e) => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - currentX;

    dietItem.classList.remove(CSS_CLASSES.DIET_ITEM_SWIPING);
    dietItem.style.transition = "transform 0.3s ease, opacity 0.3s ease";

    if (diff > 50) {
      dietItem.style.transform = "translateX(-100%)";
      dietItem.style.opacity = "0";

      setTimeout(async () => {
        dietItem.remove(); // Elimina per tancar gap
        updateDietListVisibility(); // Actualitza immediat (mostra text si última)
        await deleteDietHandler(dietId, dietDate, dietType);
      }, 300);
    } else {
      dietItem.style.transform = "translateX(0)";
      dietItem.style.opacity = "1";
    }

    setTimeout(() => {
      dietItem.style.transition = "";
      dietItem.style.opacity = "";
    }, 300);
  });
}

function initSwipeToDelete(dietItem, dietId, dietDate, dietType) {
  let startX = 0;
  let currentX = 0;
  let isSwiping = false;

  dietItem.addEventListener(
    "touchstart",
    (e) => {
      if (e.target.closest("button") || e.target.closest(".diet-icons")) return;
      startX = e.touches[0].clientX;
      currentX = startX;
      isSwiping = false;
      e.stopPropagation(); // MILLORA: Prevén propagació per evitar afectar modal/tabs
    },
    { passive: false }
  );

  dietItem.addEventListener(
    "touchmove",
    (e) => {
      currentX = e.touches[0].clientX;
      const diff = startX - currentX;
      if (diff > 10 && !isSwiping) {
        isSwiping = true;
        dietItem.classList.add(CSS_CLASSES.DIET_ITEM_SWIPING);
        dietModalElement.style.overflow = "hidden"; // MILLORA: Bloqueja scroll de modal durant swipe
      }
      if (isSwiping && diff > 10) {
        dietItem.style.transform = `translateX(-${Math.min(diff, 80)}px)`;
        e.preventDefault();
        e.stopPropagation(); // MILLORA: Prevén propagació
      }
    },
    { passive: false }
  );

  dietItem.addEventListener("touchend", async (e) => {
    if (!isSwiping) return;
    isSwiping = false;
    const diff = startX - currentX;

    dietItem.classList.remove(CSS_CLASSES.DIET_ITEM_SWIPING);
    dietItem.style.transition = "transform 0.3s ease, opacity 0.3s ease";

    if (diff > 50) {
      dietItem.style.transform = "translateX(-100%)";
      dietItem.style.opacity = "0";

      setTimeout(async () => {
        dietItem.remove(); // Elimina per tancar gap
        updateDietListVisibility(); // Actualitza immediat (mostra text si última)
        await deleteDietHandler(dietId, dietDate, dietType);
      }, 300);
    } else {
      dietItem.style.transform = "translateX(0)";
      dietItem.style.opacity = "1";
      dietModalElement.style.overflow = ""; // MILLORA: Restaura si no elimina
    }

    setTimeout(() => {
      dietItem.style.transition = "";
      dietItem.style.opacity = "";
    }, 300);

    e.stopPropagation(); // MILLORA: Prevén propagació en touchend
  });

  initMouseSwipeToDelete(dietItem, dietId, dietDate, dietType);
}

// Afegeix el mateix e.stopPropagation() i gestió d'overflow a initMouseSwipeToDelete si cal per consistència, tot i que mouse rarament bubbla igual.

export function restoreDietItemToList(diet) {
  if (!dietOptionsListElement || !noDietsTextElement) {
    displayDietOptions();
    return;
  }

  const originalIndex = diet.index || 0; // Recupera index
  const restoredItem = _createDietListItem(diet);
  restoredItem.style.opacity = "0";
  restoredItem.style.transform = "translateX(-100%)"; // MILLORA ANIMACIÓ: Inicia des de l'esquerra (fora de pantalla)

  // Insereix en posició
  const sibling = dietOptionsListElement.children[originalIndex];
  if (sibling) {
    dietOptionsListElement.insertBefore(restoredItem, sibling);
  } else {
    dietOptionsListElement.appendChild(restoredItem);
  }

  requestAnimationFrame(() => {
    restoredItem.style.transition = "opacity 0.5s ease, transform 0.5s ease"; // MILLORA ANIMACIÓ: Transició per slide-in + fade
    restoredItem.style.opacity = "1";
    restoredItem.style.transform = "translateX(0)"; // Slide-in a posició original
    initSwipeToDelete(restoredItem, diet.id, diet.date, diet.dietType);
  });
  updateDietListVisibility();
  dietOptionsListElement.classList.remove(CSS_CLASSES.HIDDEN);
  noDietsTextElement.classList.add(CSS_CLASSES.HIDDEN);
}
