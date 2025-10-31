import {
  addSwipeListeners,
  removeSwipeListeners,
  setSwipeEnabled,
} from "../tabs.js";
import { logger } from "../../utils/logger.js";

export const CSS_CLASSES = {
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

export const DOM_IDS = {
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

export const SELECTORS = {
  MODAL: ".modal",
  MODAL_CLOSE_BTN: ".close-modal, .close-modal-btn",
  MODAL_TRIGGER: 'a[href^="#"]',
  FOCUSABLE_ELEMENTS:
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
};

export const DATA_ATTRIBUTES = {
  DIET_ID: "data-diet-id",
  DIET_DATE: "data-diet-date",
  DIET_TYPE: "data-diet-type",
};

const log = logger.withScope("Modals:Manager");

const modalStack = [];
let previousActiveElement = null;
let outsideClickListener = null;
let escapeKeyListener = null;
const dismissHandlers = new Map();

function getTopModal() {
  return modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
}

function ensureGlobalListeners() {
  if (!outsideClickListener) {
    outsideClickListener = (event) => {
      const topModal = getTopModal();
      if (!topModal) return;
      if (event.target === topModal) {
        const handler = dismissHandlers.get(topModal.id);
        if (handler) {
          handler({ reason: "backdrop" });
        } else {
          closeModal(topModal);
        }
      }
    };
    document.addEventListener("click", outsideClickListener, true);
  }

  if (!escapeKeyListener) {
    escapeKeyListener = (event) => {
      if (event.key !== "Escape") return;
      const topModal = getTopModal();
      if (!topModal) return;
      const handler = dismissHandlers.get(topModal.id);
      if (handler) {
        handler({ reason: "escape" });
      } else {
        closeModal(topModal);
      }
    };
    document.addEventListener("keydown", escapeKeyListener, true);
  }
}

function teardownGlobalListeners() {
  if (outsideClickListener) {
    document.removeEventListener("click", outsideClickListener, true);
    outsideClickListener = null;
  }
  if (escapeKeyListener) {
    document.removeEventListener("keydown", escapeKeyListener, true);
    escapeKeyListener = null;
  }
}

function attachBackdropTouchBlocker(modalElement) {
  if (modalElement.dataset.backdropTouchHandled) return;
  modalElement.addEventListener(
    "touchstart",
    (event) => {
      if (event.target === modalElement) {
        event.preventDefault();
        event.stopPropagation();
      }
    },
    { passive: false }
  );
  modalElement.dataset.backdropTouchHandled = "true";
}

function applyModalStyles(modalElement) {
  modalElement.style.display = "block";
  modalElement.style.position = "fixed";
  modalElement.style.top = "0";
  modalElement.style.left = "0";
  modalElement.style.width = "100%";
  modalElement.style.height = "100vh";
  modalElement.style.background = "rgba(0,0,0,0.5)";
  modalElement.style.setProperty("pointer-events", "auto");
}

function focusFirstElement(modalElement) {
  const firstFocusable = modalElement.querySelector(
    SELECTORS.FOCUSABLE_ELEMENTS
  );
  firstFocusable?.focus();
}

export function openModal(modalElement) {
  if (!modalElement) return;

  const topModal = getTopModal();
  if (
    topModal &&
    topModal !== modalElement &&
    modalElement.id !== DOM_IDS.CONFIRM_MODAL
  ) {
    log.debug("S'ha ignorat l'obertura perquè ja hi ha un modal actiu.");
    return;
  }

  const isAlreadyStacked = modalStack.includes(modalElement);
  if (!isAlreadyStacked) {
    modalStack.push(modalElement);
  }

  const wasEmpty = modalStack.length === 1 && !isAlreadyStacked;
  if (wasEmpty) {
    previousActiveElement = document.activeElement;
    document.body.classList.add(CSS_CLASSES.MODAL_OPEN_BODY);
    removeSwipeListeners();
    setSwipeEnabled(false);
    document.body.style.setProperty("pointer-events", "none");
  }

  ensureGlobalListeners();
  attachBackdropTouchBlocker(modalElement);
  applyModalStyles(modalElement);
  focusFirstElement(modalElement);
}

export function closeModal(modalElement = getTopModal()) {
  if (!modalElement) return;

  const stackIndex = modalStack.lastIndexOf(modalElement);
  if (stackIndex === -1) {
    modalElement.style.display = "none";
    modalElement.style.removeProperty("pointer-events");
    return;
  }

  modalStack.splice(stackIndex, 1);
  modalElement.style.display = "none";
  modalElement.style.removeProperty("pointer-events");

  if (modalStack.length === 0) {
    document.body.classList.remove(CSS_CLASSES.MODAL_OPEN_BODY);
    setSwipeEnabled(true);
    addSwipeListeners();
    document.body.style.removeProperty("pointer-events");
    previousActiveElement?.focus();
    previousActiveElement = null;
    teardownGlobalListeners();
    return;
  }

  const newTopModal = getTopModal();
  if (newTopModal) {
    applyModalStyles(newTopModal);
    focusFirstElement(newTopModal);
  }
}

export function closeActiveModal() {
  closeModal(getTopModal());
}

export function registerModalTriggers() {
  const modalTriggers = document.querySelectorAll(SELECTORS.MODAL_TRIGGER);
  modalTriggers.forEach((trigger) => {
    if (trigger.dataset.modalPrepared === "true") return;

    const modalId = trigger.getAttribute("href")?.substring(1);
    if (!modalId) return;

    const targetModal = document.getElementById(modalId);
    if (targetModal && targetModal.matches(SELECTORS.MODAL)) {
      trigger.addEventListener("click", (event) => {
        event.preventDefault();
        openModal(targetModal);
      });

      const closeButtons = targetModal.querySelectorAll(
        SELECTORS.MODAL_CLOSE_BTN
      );
      closeButtons.forEach((btn) => {
        if (btn.dataset.modalPrepared === "true") return;
        btn.addEventListener("click", () => closeModal(targetModal));
        btn.dataset.modalPrepared = "true";
      });
    }

    trigger.dataset.modalPrepared = "true";
  });
}

export function registerDismissHandler(modalId, handler) {
  if (!modalId) return;
  if (typeof handler === "function") {
    dismissHandlers.set(modalId, handler);
  } else {
    dismissHandlers.delete(modalId);
  }
}

export function isAnyModalOpen() {
  return modalStack.length > 0;
}

export function getActiveModalElement() {
  return getTopModal();
}
