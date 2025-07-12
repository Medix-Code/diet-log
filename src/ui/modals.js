/**
 * @file modals.js
 * @description Gestiona modals.
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
  console.log("Obrint modal: " + modalElement.id); // Log per depuració
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
        console.log("Clic fora del modal: " + activeModalElement.id); // Log per depuració
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
        console.log("Escape premut al modal: " + activeModalElement.id); // Log per depuració
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
  console.log("Tancant modal: " + activeModalElement?.id); // Log per depuració
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

  const previousActiveModal = activeModalElement; // Guarda temporalment per logs si cal
  activeModalElement = null;

  const anotherModalIsOpen = document.querySelector(
    '.modal[style*="display: block"]'
  );
  if (!anotherModalIsOpen) {
    document.body.classList.remove(CSS_CLASSES.MODAL_OPEN_BODY);
  }

  // NOU: Si es tanca confirm i hi havia un modal previ, restaura'l com actiu
  if (isConfirmModalClosing && previousModalElement) {
    activeModalElement = previousModalElement;
    // Re-afegeix listeners per al modal previ (ja que es van eliminar)
    currentOutsideClickListener = (event) => {
      if (event.target === activeModalElement) {
        console.log("Clic fora del modal: " + activeModalElement.id);
        _closeGenericModal();
      }
    };
    document.addEventListener("click", currentOutsideClickListener, true);

    currentEscapeKeyListener = (event) => {
      if (event.key === "Escape" && activeModalElement) {
        console.log("Escape premut al modal: " + activeModalElement.id);
        _closeGenericModal();
      }
    };
    document.addEventListener("keydown", currentEscapeKeyListener, true);

    // Restaura focus al modal previ
    const firstFocusable = activeModalElement.querySelector(
      SELECTORS.FOCUSABLE_ELEMENTS
    );
    firstFocusable?.focus();

    previousModalElement = null; // Reseteja per següents usos
  } else if (!isConfirmModalClosing && previousActiveElement) {
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

  // Crea el wrapper per moure contingut durant swipe
  const dietItemContent = document.createElement("div");
  dietItemContent.className = "diet-item-content";

  // Crea el text de la data
  const dateSpan = document.createElement("span");
  dateSpan.className = CSS_CLASSES.DIET_DATE;
  let displayText = ddmmaa;
  if (creationTime) displayText += ` [${creationTime}]`;
  displayText += ` - ${capitalizeFirstLetter(franjaText)}`;
  dateSpan.textContent = displayText;

  // Crea el contenidor d'icones
  const iconsContainer = document.createElement("div");
  iconsContainer.className = CSS_CLASSES.DIET_ICONS;

  // Crea el reveal de delete (fora del wrapper)
  const deleteReveal = document.createElement("div");
  deleteReveal.className = "delete-reveal";
  deleteReveal.innerHTML = `<img src="assets/icons/delete.svg" alt="Eliminar" class="icon">`;

  // Botó de Cargar (minimalista, sense listener directe: maneja via bubbling)
  const loadBtn = document.createElement("button");
  loadBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} ${CSS_CLASSES.LIST_ITEM_BTN_LOAD} ${CSS_CLASSES.DIET_LOAD_BTN}`;
  loadBtn.setAttribute("aria-label", `Cargar dieta ${ddmmaa}`);
  loadBtn.innerHTML = `<img src="assets/icons/upload2.svg" alt="" class="icon"><span class="btn-text visually-hidden">Cargar</span>`;
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_ID, diet.id);
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_DATE, diet.date);
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_TYPE, diet.dietType);

  // Botó de Descarregar PDF (minimalista, sense listener directe: maneja via bubbling)
  const downloadBtn = document.createElement("button");
  downloadBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} diet-download`; // Mantinc, però ajustarem CSS
  downloadBtn.setAttribute(
    "aria-label",
    `Descarregar PDF de la dieta ${ddmmaa}`
  );
  downloadBtn.innerHTML = `<img src="assets/icons/download_blue.svg" alt="" class="icon"><span class="btn-text visually-hidden">PDF</span>`;
  downloadBtn.setAttribute(DATA_ATTRIBUTES.DIET_ID, diet.id);

  // Append botons a iconsContainer
  iconsContainer.appendChild(loadBtn);
  iconsContainer.appendChild(downloadBtn);

  // Append text i icons al wrapper
  dietItemContent.appendChild(dateSpan);
  dietItemContent.appendChild(iconsContainer);

  // Append wrapper i reveal a l'ítem principal
  dietItem.appendChild(dietItemContent);
  dietItem.appendChild(deleteReveal);

  return dietItem;
}

export async function _handleDietListClick(event) {
  console.log("Clic a llista de dietes"); // Log per depuració
  const target = event.target;
  const loadButton = target.closest(`.${CSS_CLASSES.DIET_LOAD_BTN}`);
  const deleteButton = target.closest(`.${CSS_CLASSES.DIET_DELETE_BTN}`);
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
      // console.error(error);
    }
  } else if (deleteButton) {
    event.stopPropagation();
    const dietId = deleteButton.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    const dietDate = deleteButton.getAttribute(DATA_ATTRIBUTES.DIET_DATE);
    const dietType = deleteButton.getAttribute(DATA_ATTRIBUTES.DIET_TYPE);
    if (dietId) {
      deleteDietHandler(dietId, dietDate, dietType);
    }
  } else if (downloadButton) {
    event.stopPropagation();
    const dietId = downloadButton.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    if (dietId) {
      downloadDietPDF(dietId);
    }
  }
}

function _trapConfirmFocus(event) {
  if (
    !confirmModalElement ||
    confirmModalElement !== activeModalElement ||
    event.key !== "Tab"
  )
    return;
  const focusables = Array.from(
    confirmModalElement.querySelectorAll(SELECTORS.FOCUSABLE_ELEMENTS)
  ).filter((el) => el.offsetParent !== null);
  if (focusables.length === 0) return;
  const firstFocusable = focusables[0];
  const lastFocusable = focusables[focusables.length - 1];
  if (event.shiftKey) {
    if (document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    }
  } else {
    if (document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }
}

// Lògica de confirmació refactoritzada i simplificada
function _cleanupConfirmModalListeners() {
  if (confirmNoBtn) confirmNoBtn.removeEventListener("click", _handleConfirmNo);
  if (confirmYesBtn)
    confirmYesBtn.removeEventListener("click", _handleConfirmYes);
  document.removeEventListener("keydown", _trapConfirmFocus);
}

function _resolveAndClose(value) {
  console.log(`Resolent confirmació amb valor: ${value}`); // Log per depuració
  if (currentConfirmResolve) {
    currentConfirmResolve(value);
    currentConfirmResolve = null; // Reseteja la promesa
  }
  _cleanupConfirmModalListeners();
  _closeGenericModal(); // Tanca completament
}

function _handleConfirmYes() {
  console.log("Botó Sí clicat"); // Log per depuració
  _resolveAndClose(true);
}

function _handleConfirmNo() {
  console.log("Botó No clicat"); // Log per depuració
  _resolveAndClose(false);
}

let previousModalElement = null;

export function showConfirmModal(message, title = "Confirmar acció") {
  console.log("Obrint confirm modal amb missatge: " + message); // Log per depuració
  if (!confirmModalElement) return Promise.resolve(false);

  // Evita obrir un modal de confirmació si ja n'hi ha un d'obert
  if (currentConfirmResolve) {
    console.warn("Intent d'obrir un segon modal de confirmació ignorat.");
    return Promise.resolve(false);
  }

  // NOU: Guarda el modal actiu previ (per exemple, el de dietes)
  previousModalElement = activeModalElement;

  return new Promise((resolve) => {
    currentConfirmResolve = resolve;
    confirmTitleElement.textContent = title;
    confirmMsgElement.textContent = message;

    // Neteja listeners antics per seguretat
    _cleanupConfirmModalListeners();

    // Afegeix listeners nous
    confirmYesBtn.addEventListener("click", _handleConfirmYes);
    confirmNoBtn.addEventListener("click", _handleConfirmNo);
    document.addEventListener("keydown", _trapConfirmFocus);

    // Utilitza la funció genèrica per obrir el modal
    _openGenericModal(confirmModalElement);

    // Força el focus al botó "Sí"
    confirmYesBtn.focus();
  });
}
// --- Funcions Públiques ---

// NOU: Funció per eliminar un ítem específic de la llista amb animació suau (slide + fade)
export function removeDietItemFromList(dietId) {
  if (!dietOptionsListElement) return;

  const itemToRemove = dietOptionsListElement
    .querySelector(`[data-diet-id="${dietId}"]`)
    ?.closest(".diet-item");
  if (!itemToRemove) return;

  // NOU: Animació combinada: Slide cap a l'esquerra + fade out
  itemToRemove.style.transition = "transform 0.5s ease, opacity 0.5s ease"; // Durada més llarga per suavitat
  itemToRemove.style.transform = "translateX(-100%)"; // Mou completament cap a l'esquerra
  itemToRemove.style.opacity = "0";

  setTimeout(() => {
    itemToRemove.remove();
    // Si no queden ítems, mostra el text de "No hay dietas"
    if (dietOptionsListElement.children.length === 0) {
      dietOptionsListElement.classList.add(CSS_CLASSES.HIDDEN);
      noDietsTextElement.classList.remove(CSS_CLASSES.HIDDEN);
      noDietsTextElement.textContent = "No hay dietas guardadas.";
    }
  }, 500); // Durada de l'animació (ajusta si cal)
}

export function setupModalGenerics() {
  console.log("Setup de modals genèrics"); // Log per depuració
  confirmModalElement = document.getElementById(DOM_IDS.CONFIRM_MODAL);
  if (confirmModalElement) {
    confirmMsgElement = document.getElementById(DOM_IDS.CONFIRM_MESSAGE);
    confirmTitleElement = confirmModalElement.querySelector(
      DOM_IDS.CONFIRM_TITLE
    );
    confirmYesBtn = document.getElementById(DOM_IDS.CONFIRM_YES_BTN);
    confirmNoBtn = document.getElementById(DOM_IDS.CONFIRM_NO_BTN);
    if (
      !confirmMsgElement ||
      !confirmTitleElement ||
      !confirmYesBtn ||
      !confirmNoBtn
    ) {
      confirmModalElement = null;
    }
  }

  const modalTriggers = document.querySelectorAll(SELECTORS.MODAL_TRIGGER);
  modalTriggers.forEach((trigger) => {
    const modalId = trigger.getAttribute("href")?.substring(1);
    if (!modalId) return;
    const targetModal = document.getElementById(modalId);

    if (targetModal && targetModal.matches(SELECTORS.MODAL)) {
      if (trigger.dataset.modalSetup === "true") return;
      trigger.dataset.modalSetup = "true";

      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        _openGenericModal(targetModal);
      });

      const closeButtons = targetModal.querySelectorAll(
        SELECTORS.MODAL_CLOSE_BTN
      );
      closeButtons.forEach((btn) => {
        if (btn.dataset.modalCloseSetup === "true") return;
        btn.dataset.modalCloseSetup = "true";
        btn.addEventListener("click", () => _closeGenericModal());
      });
    }
  });
}

// En openDietModal, re-bind el botó "Cerrar"
export function openDietModal() {
  console.log("Obrint modal de dietes"); // Log per depuració
  if (!dietModalElement) {
    dietModalElement = document.getElementById(DOM_IDS.DIET_MODAL);
    dietOptionsListElement = document.getElementById(DOM_IDS.DIET_OPTIONS_LIST);
    noDietsTextElement = document.getElementById(DOM_IDS.NO_DIETS_TEXT);

    const closeDietBtn = document.getElementById("close-diet-modal");
    if (closeDietBtn) {
      closeDietBtn.removeEventListener("click", closeDietModal); // Elimina antic per seguretat
      closeDietBtn.addEventListener("click", closeDietModal);
      console.log("Listener de Cerrar re-afegit en obertura"); // Log per depuració
    }

    if (dietOptionsListElement) {
      dietOptionsListElement.addEventListener("click", _handleDietListClick);
    } else {
      dietModalElement = null;
    }
  }
  if (dietModalElement) {
    _openGenericModal(dietModalElement);
    displayDietOptions();
  }
}
export function closeDietModal() {
  console.log("Tancant modal de dietes"); // Log per depuració
  if (activeModalElement && activeModalElement.id === DOM_IDS.DIET_MODAL) {
    _closeGenericModal();
  }
}

export async function displayDietOptions() {
  console.log("Mostrant opcions de dietes"); // Log per depuració
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

      savedDiets.sort((a, b) => {
        if (!a.timeStampDiet) return 1;
        if (!b.timeStampDiet) return -1;
        return new Date(b.timeStampDiet) - new Date(a.timeStampDiet);
      });

      savedDiets.forEach((diet) => {
        const listItem = _createDietListItem(diet);
        dietOptionsListElement.appendChild(listItem);
        initSwipeToDelete(listItem, diet.id, diet.date, diet.dietType);
      });
    }
  } catch (error) {
    dietOptionsListElement.classList.add(CSS_CLASSES.HIDDEN);
    noDietsTextElement.classList.remove(CSS_CLASSES.HIDDEN);
    noDietsTextElement.textContent = "Error al cargar las dietas.";
  }
  const closeDietBtn = document.getElementById("close-diet-modal");
  if (closeDietBtn) {
    closeDietBtn.removeEventListener("click", closeDietModal); // Elimina antic per evitar duplicitats
    closeDietBtn.addEventListener("click", closeDietModal); // Re-afegeix
    console.log("Listener de Cerrar re-afegit després de refresh"); // Log temporal per depuració
  }
}

// Per initMouseSwipeToDelete: Aplica el mateix patró
function initMouseSwipeToDelete(dietItem, dietId, dietDate, dietType) {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  let isConfirming = false;

  dietItem.addEventListener("mousedown", (e) => {
    console.log("Mousedown al modal - Drag iniciat (PC)"); // Log per depuració
    if (e.target.closest("button") || e.target.closest(".diet-icons")) return;
    startX = e.clientX;
    currentX = startX;
    isDragging = false; // NOU: No inicis dragging immediat; espera moviment
    // NOU: No stop/prevent aquí; permet bubbling si no hi ha drag
  });

  document.addEventListener("mousemove", (e) => {
    currentX = e.clientX;
    const diff = startX - currentX;
    if (diff > 10 && !isDragging) {
      // NOU: Inicia només si hi ha moviment >10px
      isDragging = true;
      dietItem.classList.add(CSS_CLASSES.DIET_ITEM_SWIPING);
    }
    if (isDragging && diff > 10) {
      dietItem.style.transform = `translateX(-${Math.min(diff, 80)}px)`;
      e.stopPropagation(); // NOU: Només aquí, quan hi ha drag real
      e.preventDefault();
    }
  });

  document.addEventListener("mouseup", async (e) => {
    console.log("Mouseup al modal - Drag finalitzat (PC)"); // Log per depuració
    if (!isDragging || isConfirming) {
      // NOU: Si només clic (sense dragging), permet bubbling (no stop)
      return;
    }
    isDragging = false;
    isConfirming = true;
    const diff = startX - currentX;

    dietItem.classList.remove(CSS_CLASSES.DIET_ITEM_SWIPING);
    dietItem.style.transition = "transform 0.3s ease";

    if (diff > 50) {
      dietItem.style.transform = "translateX(-80px)";
      const { ddmmaa, franjaText } = getDietDisplayInfo(dietDate, dietType);
      const msg = `¿Confirmas que quieres eliminar permanentemente la dieta de la ${franjaText} del ${ddmmaa}?`;

      const confirmed = await showConfirmModal(msg, "Eliminar dieta");
      console.log(`Confirmació rebuda: ${confirmed}`); // Log per depuració

      if (confirmed) {
        await deleteDietHandler(dietId, dietDate, dietType);
      } else {
        dietItem.style.transform = "translateX(0)";
      }
      e.stopPropagation(); // NOU: Només aquí per drag complet
      e.preventDefault();
    } else {
      dietItem.style.transform = "translateX(0)";
      e.stopPropagation(); // Opcional: Si vols bloquejar bubbling en retorns
      e.preventDefault();
    }

    setTimeout(() => {
      dietItem.style.transition = "";
      isConfirming = false;
    }, 300);
  });
}

function initSwipeToDelete(dietItem, dietId, dietDate, dietType) {
  let startX = 0;
  let currentX = 0;
  let isSwiping = false;
  let isConfirming = false;

  dietItem.addEventListener(
    "touchstart",
    (e) => {
      console.log("Touchstart al modal - Swipe iniciat sense propagació"); // Log per depuració
      if (e.target.closest("button") || e.target.closest(".diet-icons")) return; // Ignora si toc botons
      startX = e.touches[0].clientX;
      currentX = startX;
      isSwiping = false; // Espera moviment
      // NOU: No stop/prevent aquí; permet bubbling si no hi ha swipe
    },
    { passive: false }
  );

  dietItem.addEventListener(
    "touchmove",
    (e) => {
      console.log("Touchmove al modal - Swipe en curs sense propagació"); // Log per depuració
      currentX = e.touches[0].clientX;
      const diff = startX - currentX;
      if (diff > 10 && !isSwiping) {
        // Inicia swipe
        isSwiping = true;
        dietItem.classList.add(CSS_CLASSES.DIET_ITEM_SWIPING);
      }
      if (isSwiping && diff > 10) {
        dietItem.style.transform = `translateX(-${Math.min(diff, 80)}px)`;
        e.stopPropagation(); // NOU: Només aquí, quan hi ha swipe real
        e.preventDefault();
      }
    },
    { passive: false }
  );

  dietItem.addEventListener("touchend", async (e) => {
    console.log("Touchend al modal - Swipe finalitzat sense propagació"); // Log per depuració
    if (!isSwiping || isConfirming) {
      // Si només clic, permet bubbling (no stop)
      return; // NOU: Elimina stop/prevent per clics simples
    }
    isSwiping = false;
    isConfirming = true;
    const diff = startX - currentX;

    dietItem.classList.remove(CSS_CLASSES.DIET_ITEM_SWIPING);
    dietItem.style.transition = "transform 0.3s ease";

    if (diff > 50) {
      dietItem.style.transform = "translateX(-80px)";
      const { ddmmaa, franjaText } = getDietDisplayInfo(dietDate, dietType);
      const msg = `¿Confirmas que quieres eliminar permanentemente la dieta de la ${franjaText} del ${ddmmaa}?`;

      const confirmed = await showConfirmModal(msg, "Eliminar dieta");
      console.log(`Confirmació rebuda: ${confirmed}`); // Log per depuració

      if (confirmed) {
        await deleteDietHandler(dietId, dietDate, dietType);
      } else {
        dietItem.style.transform = "translateX(0)";
      }
      e.stopPropagation(); // NOU: Només aquí per swipe complet
      e.preventDefault();
    } else {
      dietItem.style.transform = "translateX(0)";
      e.stopPropagation(); // Opcional: Si vols bloquejar bubbling en retorns
      e.preventDefault();
    }

    setTimeout(() => {
      dietItem.style.transition = "";
      isConfirming = false;
    }, 300);
  });

  initMouseSwipeToDelete(dietItem, dietId, dietDate, dietType); // Aplica canvis similars
}
