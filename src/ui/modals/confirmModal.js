import { logger } from "../../utils/logger.js";
import {
  DOM_IDS,
  openModal,
  closeModal,
  registerDismissHandler,
} from "./modalManager.js";

const log = logger.withScope("Modals:Confirm");

let confirmModalElement = null;
let confirmMsgElement = null;
let confirmTitleElement = null;
let confirmYesBtn = null;
let confirmNoBtn = null;

function ensureElements() {
  if (!confirmModalElement) {
    confirmModalElement = document.getElementById(DOM_IDS.CONFIRM_MODAL);
    if (!confirmModalElement) return false;
    confirmMsgElement = document.getElementById(DOM_IDS.CONFIRM_MESSAGE);
    confirmTitleElement =
      confirmModalElement.querySelector(DOM_IDS.CONFIRM_TITLE);
    confirmYesBtn = document.getElementById(DOM_IDS.CONFIRM_YES_BTN);
    confirmNoBtn = document.getElementById(DOM_IDS.CONFIRM_NO_BTN);
  }
  return (
    !!confirmModalElement &&
    !!confirmMsgElement &&
    !!confirmTitleElement &&
    !!confirmYesBtn &&
    !!confirmNoBtn
  );
}

function teardownDismissHandler() {
  registerDismissHandler(DOM_IDS.CONFIRM_MODAL, null);
}

export function setupConfirmModal() {
  ensureElements();
}

export function showConfirmModal(message, title = "Confirmar acció") {
  if (!ensureElements()) {
    log.warn("No s'ha trobat el modal de confirmació; es retorna false.");
    return Promise.resolve(false);
  }

  confirmTitleElement.textContent = title;
  confirmMsgElement.textContent = message;

  return new Promise((resolve) => {
    const resolveYes = () => {
      teardownDismissHandler();
      closeModal(confirmModalElement);
      resolve(true);
    };
    const resolveNo = () => {
      teardownDismissHandler();
      closeModal(confirmModalElement);
      resolve(false);
    };

    confirmYesBtn.addEventListener("click", resolveYes, { once: true });
    confirmNoBtn.addEventListener("click", resolveNo, { once: true });

    registerDismissHandler(DOM_IDS.CONFIRM_MODAL, resolveNo);
    openModal(confirmModalElement);
    confirmYesBtn.focus();
  });
}
