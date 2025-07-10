/**
 * @file toast.js
 * @description Sistema de notificacions Toast amb cua i accessibilitat.
 * @module toastNotifier
 */

// --- Constants ---
const CONTAINER_ID = "toast-container";
const TOAST_CLASS = "toast";
const DEFAULT_DURATION = 3000;
const DEFAULT_TYPE = "info";

// --- Variables d'Estat ---
let toastQueue = [];
let isToastVisible = false;
let toastContainerElement = null;

// --- Funcions Privades ---

/** Processa el següent missatge de la cua. */
function _processQueue() {
  if (isToastVisible || toastQueue.length === 0) return;

  if (!toastContainerElement) {
    toastContainerElement = document.getElementById(CONTAINER_ID);
    if (!toastContainerElement) {
      console.error(`[Toast] Contenidor '${CONTAINER_ID}' no trobat.`);
      toastQueue = [];
      return;
    }
  }

  isToastVisible = true;
  const toastData = toastQueue.shift();
  _displayToast(toastData);
}

/**
 * Mostra un toast.
 * @param {Object} toastData - { message, type, duration }
 */
function _displayToast({ message, type, duration }) {
  const toastElement = document.createElement("div");
  toastElement.className = `${TOAST_CLASS} ${type || DEFAULT_TYPE}`;
  toastElement.textContent = message.replace(/[<>&]/g, ""); // Sanitització
  toastElement.setAttribute("role", "alert");
  toastElement.setAttribute("aria-live", "polite");

  toastContainerElement.appendChild(toastElement);

  setTimeout(() => {
    toastElement.remove();
    isToastVisible = false;
    _processQueue();
  }, duration || DEFAULT_DURATION);
}

// --- Funcions Públiques ---

/**
 * Afegeix un toast a la cua.
 * @param {string} message
 * @param {string} [type=DEFAULT_TYPE]
 * @param {number} [duration=DEFAULT_DURATION]
 * @export
 */
export function showToast(
  message,
  type = DEFAULT_TYPE,
  duration = DEFAULT_DURATION
) {
  if (!message || duration < 0) return; // Edge cases
  toastQueue.push({ message, type, duration });
  _processQueue();
}

/**
 * Cancel·la tots els toasts pendents.
 * @export
 */
export function cancelAllToasts() {
  toastQueue = [];
  if (isToastVisible) {
    // Opcional: eliminar toast actual si cal
  }
}
