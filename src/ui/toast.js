/**
 * @file toast.js
 * @description Sistema de notificacions Toast amb cua.
 * @module toastNotifier
 */

// --- Constants ---
const CONTAINER_ID = "toast-container";
const TOAST_CLASS = "toast"; // Classe base per a cada toast
const DEFAULT_DURATION = 3000; // Duració per defecte en ms
const DEFAULT_TYPE = "info"; // Tipus per defecte si no s'especifica

// --- Variables d'Estat del Mòdul ---
let toastQueue = []; // Cua de missatges pendents { message, type, duration }
let isToastVisible = false; // Flag per saber si hi ha un toast actiu
let toastContainerElement = null; // Cache del contenidor

// --- Funcions Privades ---

/** Processa el següent missatge de la cua si no hi ha cap toast visible. */
function _processQueue() {
  if (isToastVisible || toastQueue.length === 0) {
    return; // No fa res si ja hi ha un toast o la cua està buida
  }

  // Cacheja el contenidor si encara no s'ha fet
  if (!toastContainerElement) {
    toastContainerElement = document.getElementById(CONTAINER_ID);
    if (!toastContainerElement) {
      console.error(
        `[Toast] Contenidor amb ID '${CONTAINER_ID}' no trobat! No es poden mostrar toasts.`
      );
      toastQueue = []; // Buidem la cua si no hi ha contenidor
      return;
    }
  }

  isToastVisible = true; // Marca com a visible abans de crear
  const toastData = toastQueue.shift(); // Treu el primer de la cua
  _displayToast(toastData);
}

/**
 * Crea i mostra un element toast al DOM.
 * @param {object} toastData - Objecte amb { message, type, duration }.
 */
function _displayToast({ message, type, duration }) {
  const toastElement = document.createElement("div");
  // Aplica classe base i classe de tipus (success, error, etc.)
  toastElement.className = `${TOAST_CLASS} ${type || DEFAULT_TYPE}`;
  toastElement.textContent = message;

  // Accessibilitat: Informa als lectors de pantalla
  toastElement.setAttribute("role", "alert");
  // 'polite' espera que acabi de parlar, 'assertive' interromp
  // toastElement.setAttribute('aria-live', 'polite');

  // Afegeix el toast al contenidor
  toastContainerElement.appendChild(toastElement);

  // Temporitzador per eliminar el toast i processar el següent
  setTimeout(() => {
    // Animació de sortida (opcional, es pot fer amb CSS)
    // toastElement.style.opacity = '0';
    // toastElement.style.transform = 'translateY(10px)';
    // setTimeout(() => { // Espera que acabi l'animació CSS
    toastElement.remove();
    isToastVisible = false; // Marca com no visible
    _processQueue(); // Intenta processar el següent
    // }, 300); // Temps de l'animació de sortida
  }, duration || DEFAULT_DURATION);
}

// --- Funcions Públiques ---

/**
 * Afegeix un missatge a la cua de toasts per mostrar.
 * @param {string} message - El missatge a mostrar.
 * @param {('success'|'error'|'info'|'warning')} [type='info'] - El tipus de toast (per estil CSS).
 * @param {number} [duration=DEFAULT_DURATION] - Duració en milisegons.
 * @export
 */
export function showToast(
  message,
  type = DEFAULT_TYPE,
  duration = DEFAULT_DURATION
) {
  if (!message) return; // No afegeix toasts buits

  toastQueue.push({ message, type, duration });
  _processQueue(); // Intenta processar immediatament
}
