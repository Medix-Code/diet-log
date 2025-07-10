/**
 * @file modals.js
 * @description Gestiona modals.
 * @module modals
 */

import { loadDietById, deleteDietHandler } from "../services/dietService.js";
import { getDietDisplayInfo, capitalizeFirstLetter } from "../utils/utils.js";
import { getAllDiets } from "../db/indexedDbDietRepository.js";

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
  )
    return;

  if (!activeModalElement) previousActiveElement = document.activeElement;

  activeModalElement = modalElement;
  modalElement.style.display = "block";
  document.body.classList.add(CSS_CLASSES.MODAL_OPEN_BODY);

  if (!currentOutsideClickListener) {
    currentOutsideClickListener = (event) => {
      if (event.target === activeModalElement) {
        if (
          activeModalElement.id === DOM_IDS.CONFIRM_MODAL &&
          currentConfirmResolve
        ) {
          currentConfirmResolve(false);
          _closeConfirmModal();
        } else if (activeModalElement.id !== DOM_IDS.CONFIRM_MODAL) {
          _closeGenericModal();
        }
      }
    };
    document.addEventListener("click", currentOutsideClickListener, true);
  }

  if (!currentEscapeKeyListener) {
    currentEscapeKeyListener = (event) => {
      if (event.key === "Escape" && activeModalElement) {
        if (
          activeModalElement.id === DOM_IDS.CONFIRM_MODAL &&
          currentConfirmResolve
        ) {
          currentConfirmResolve(false);
          _closeConfirmModal();
        } else if (activeModalElement.id !== DOM_IDS.CONFIRM_MODAL) {
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
  document.body.classList.remove(CSS_CLASSES.MODAL_OPEN_BODY);
  activeModalElement = null;

  if (!currentConfirmResolve) {
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

  const dateSpan = document.createElement("span");
  dateSpan.className = CSS_CLASSES.DIET_DATE;

  let displayText = ddmmaa;
  if (creationTime) displayText += ` [${creationTime}]`;
  displayText += ` - ${capitalizeFirstLetter(franjaText)}`;

  dateSpan.textContent = displayText;

  const iconsContainer = document.createElement("div");
  iconsContainer.className = CSS_CLASSES.DIET_ICONS;

  const deleteBtn = document.createElement("button");
  deleteBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} ${CSS_CLASSES.LIST_ITEM_BTN_DELETE} ${CSS_CLASSES.DIET_DELETE_BTN}`;
  deleteBtn.setAttribute("aria-label", `Eliminar dieta ${ddmmaa}`);
  deleteBtn.innerHTML = `<img src="assets/icons/delete.svg" alt="" class="icon"><span class="btn-text visually-hidden">Eliminar</span>`;
  deleteBtn.setAttribute(DATA_ATTRIBUTES.DIET_ID, diet.id);
  deleteBtn.setAttribute(DATA_ATTRIBUTES.DIET_DATE, diet.date);
  deleteBtn.setAttribute(DATA_ATTRIBUTES.DIET_TYPE, diet.dietType);

  const loadBtn = document.createElement("button");
  loadBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} ${CSS_CLASSES.LIST_ITEM_BTN_LOAD} ${CSS_CLASSES.DIET_LOAD_BTN}`;
  loadBtn.setAttribute("aria-label", `Cargar dieta ${ddmmaa}`);
  loadBtn.innerHTML = `<img src="assets/icons/upload.svg" alt="" class="icon"><span class="btn-text visually-hidden">Cargar</span>`;
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_ID, diet.id);
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_DATE, diet.date);
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_TYPE, diet.dietType);

  iconsContainer.appendChild(deleteBtn);
  iconsContainer.appendChild(loadBtn);
  dietItem.appendChild(dateSpan);
  dietItem.appendChild(iconsContainer);

  return dietItem;
}

async function _handleDietListClick(event) {
  const target = event.target;
  const loadButton = target.closest(`.${CSS_CLASSES.DIET_LOAD_BTN}`);
  const deleteButton = target.closest(`.${CSS_CLASSES.DIET_DELETE_BTN}`);

  if (loadButton) {
    event.stopPropagation();
    const dietId = loadButton.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    const dietDate = loadButton.getAttribute(DATA_ATTRIBUTES.DIET_DATE);
    const dietType = loadButton.getAttribute(DATA_ATTRIBUTES.DIET_TYPE);
    if (!dietId) return;

    const { ddmmaa, franjaText } = getDietDisplayInfo(dietDate, dietType);
    const confirmed = await showConfirmModal(
      `¿Quieres cargar la dieta de la ${franjaText} del ${ddmmaa}? Los datos no guardados del formulario actual se perderán.`,
      "Cargar dieta"
    );

    if (confirmed) {
      try {
        await loadDietById(dietId);
      } catch (error) {
        // Maneig
      }
    }
  } else if (deleteButton) {
    event.stopPropagation();
    const dietId = deleteButton.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    const dietDate = deleteButton.getAttribute(DATA_ATTRIBUTES.DIET_DATE);
    const dietType = deleteButton.getAttribute(DATA_ATTRIBUTES.DIET_TYPE);
    if (dietId) {
      deleteDietHandler(dietId, dietDate, dietType);
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

function _cleanupConfirmModalListeners() {
  if (confirmNoBtn) confirmNoBtn.removeEventListener("click", _handleConfirmNo);
  if (confirmYesBtn)
    confirmYesBtn.removeEventListener("click", _handleConfirmYes);
  document.removeEventListener("keydown", _trapConfirmFocus);
}

function _handleConfirmYes() {
  if (currentConfirmResolve) currentConfirmResolve(true);
  _closeConfirmModalOnly();
  currentConfirmResolve = null;
}

function _handleConfirmNo() {
  if (currentConfirmResolve) currentConfirmResolve(false);
  _closeConfirmModalOnly();
  currentConfirmResolve = null;
}

function _closeConfirmModal() {
  _cleanupConfirmModalListeners();
  _closeGenericModal();
}

function _closeConfirmModalOnly() {
  if (!confirmModalElement) return;
  confirmModalElement.style.display = "none";
  _cleanupConfirmModalListeners();
}

// --- Funcions Públiques ---

export function setupModalGenerics() {
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
        if (activeModalElement && activeModalElement !== targetModal) return;
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

export function openDietModal() {
  if (!dietModalElement) {
    dietModalElement = document.getElementById(DOM_IDS.DIET_MODAL);
    dietOptionsListElement = document.getElementById(DOM_IDS.DIET_OPTIONS_LIST);
    noDietsTextElement = document.getElementById(DOM_IDS.NO_DIETS_TEXT);

    const closeDietBtn = document.getElementById("close-diet-modal");
    if (closeDietBtn && !closeDietBtn.dataset.listenerAttached) {
      closeDietBtn.dataset.listenerAttached = "true";
      closeDietBtn.addEventListener("click", closeDietModal);
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

      savedDiets.sort((a, b) => {
        if (!a.timeStampDiet) return 1;
        if (!b.timeStampDiet) return -1;
        return new Date(b.timeStampDiet) - new Date(a.timeStampDiet);
      });

      savedDiets.forEach((diet) => {
        const listItem = _createDietListItem(diet);
        dietOptionsListElement.appendChild(listItem);
      });
    }
  } catch (error) {
    dietOptionsListElement.classList.add(CSS_CLASSES.HIDDEN);
    noDietsTextElement.classList.remove(CSS_CLASSES.HIDDEN);
    noDietsTextElement.textContent = "Error al cargar las dietas.";
  }
}

export function showConfirmModal(message, title = "Confirmar acció") {
  if (!confirmModalElement) return Promise.resolve(false);
  if (currentConfirmResolve) return Promise.resolve(false);

  return new Promise((resolve) => {
    currentConfirmResolve = resolve;
    confirmTitleElement.textContent = title;
    confirmMsgElement.textContent = message;

    confirmYesBtn.addEventListener("click", _handleConfirmYes);
    confirmNoBtn.addEventListener("click", _handleConfirmNo);
    document.addEventListener("keydown", _trapConfirmFocus);

    confirmModalElement.style.display = "block";
    confirmYesBtn.focus();
  });
}
