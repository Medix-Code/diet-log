/**
 * @file signatureService.js
 * @description Gestiona la captura de signatures mitjançant un canvas en un modal.
 *              Emmagatzema les signatures per a 'person1' (conductor) i 'person2' (ajudant).
 * @module signatureService
 */

import { setSwipeEnabled } from "../ui/tabs.js";

// --- Constants ---
const DOM_IDS = {
  MODAL: "signature-modal",
  CANVAS: "signature-canvas",
  CANCEL_BTN: "signature-cancel",
  ACCEPT_BTN: "signature-accept",
  SIGN_PERSON1_BTN: "sign-person1",
  SIGN_PERSON2_BTN: "sign-person2",
  TITLE: "signature-title",
};

const CSS_CLASSES = {
  MODAL_OPEN: "modal-open", // Classe per al body quan el modal està obert
  SIGNED: "signed", // Classe per al botó quan té una signatura
};

const CONFIG = {
  LINE_WIDTH: 2,
  LINE_CAP: "round",
  STROKE_STYLE: "#000000",
  IMAGE_FORMAT: "image/png",
  DOUBLE_CLICK_TIMEOUT: 300, // ms
  DOUBLE_TAP_TIMEOUT: 300, // ms
  DOUBLE_TAP_MAX_DIST: 20, // px
};

const ICONS = {
  SIGNATURE_PENDING: "assets/icons/signature.svg",
  SIGNATURE_OK: "assets/icons/signature_ok.svg",
};

const TITLES = {
  PERSON1: "Firma del conductor",
  PERSON2: "Firma del ayudante",
};

// --- Variables d'Estat del Mòdul ---
let signatureConductor = ""; // Base64 DataURL o string buit
let signatureAjudant = ""; // Base64 DataURL o string buit

let currentSignatureTarget = null; // 'person1' o 'person2'
let isDrawing = false;
let canvasContext = null;
let signatureCanvasElement = null;
let signatureModalElement = null;
let signPerson1Button = null;
let signPerson2Button = null;

let hasUserDrawn = false; // per controlar si s'ha dibuixat

// Variables per a doble clic/tap
let lastTouchTime = 0;
let lastTouchX = 0;
let lastTouchY = 0;
let clickCount = 0;
let clickTimer = null;

// --- Funcions Privades ---

/** Redimensiona el canvas i configura el context. */
function resizeCanvas() {
  if (!signatureCanvasElement || !signatureCanvasElement.parentElement) return;
  const container = signatureCanvasElement.parentElement;
  // Obtenim el context només si no el tenim ja o la mida canvia dràsticament
  if (!canvasContext) {
    canvasContext = signatureCanvasElement.getContext("2d", {
      willReadFrequently: true,
    });
    if (!canvasContext) {
      console.error("No s'ha pogut obtenir el context 2D del canvas.");
      return;
    }
  }

  signatureCanvasElement.width = container.offsetWidth;
  signatureCanvasElement.height = container.offsetHeight;

  // Aplica estils al context
  canvasContext.lineWidth = CONFIG.LINE_WIDTH;
  canvasContext.lineCap = CONFIG.LINE_CAP;
  canvasContext.strokeStyle = CONFIG.STROKE_STYLE;
}

/** Neteja el contingut del canvas. */
function clearCanvas() {
  if (!canvasContext || !signatureCanvasElement) return;
  canvasContext.clearRect(
    0,
    0,
    signatureCanvasElement.width,
    signatureCanvasElement.height
  );

  // >>> NOU: Reseteja el flag quan es neteja el canvas <<<
  hasUserDrawn = false;
  console.log("[Signature] Canvas netejat, hasUserDrawn = false");
}

/** Obté les coordenades (x, y) relatives al canvas des d'un esdeveniment. */
function getEventCoordinates(event) {
  if (!signatureCanvasElement) return { x: 0, y: 0 };
  const rect = signatureCanvasElement.getBoundingClientRect();
  let clientX, clientY;

  if (event.touches && event.touches.length > 0) {
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    clientX = event.clientX;
    clientY = event.clientY;
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  };
}

/** Inicia el procés de dibuix. */
function startDrawing(event) {
  if (!canvasContext) return;
  isDrawing = true;

  // Marca que l'usuari ha començat a dibuixar <<<
  hasUserDrawn = true;
  console.log("[Signature] Començant a dibuixar, hasUserDrawn = true");

  canvasContext.beginPath();
  const { x, y } = getEventCoordinates(event);
  canvasContext.moveTo(x, y);
}

/** Dibuixa una línia mentre l'usuari es mou. */
function draw(event) {
  if (!isDrawing || !canvasContext) return;
  event.preventDefault(); // Prevé scroll en dispositius tàctils mentre es dibuixa
  const { x, y } = getEventCoordinates(event);
  canvasContext.lineTo(x, y);
  canvasContext.stroke();
}

/** Atura el procés de dibuix. */
function stopDrawing() {
  if (!isDrawing || !canvasContext) return;
  isDrawing = false;
  // No cal closePath si només són línies, però no fa mal
  // canvasContext.closePath();
}

/** Gestiona el clic per detectar doble clic (esborrar). */
function handleCanvasClick(event) {
  clickCount++;
  if (clickCount === 1) {
    clickTimer = setTimeout(() => {
      clickCount = 0; // Reseteja si no hi ha segon clic
    }, CONFIG.DOUBLE_CLICK_TIMEOUT);
  } else if (clickCount === 2) {
    clearTimeout(clickTimer);
    clickCount = 0;
    event.preventDefault();
    clearCanvas();
  }
}

/** Gestiona la fi del toc per detectar doble tap (esborrar). */
function handleCanvasTouchEnd(event) {
  // Només si no s'està fent scroll (si només hi ha un punt de contacte)
  if (event.touches.length > 0) return;

  const now = Date.now();
  // Necessitem les coordenades del 'changedTouches' que s'acaba d'aixecar
  const touch = event.changedTouches[0];
  if (!touch) return;

  const { x, y } = getEventCoordinates({
    clientX: touch.clientX,
    clientY: touch.clientY,
  }); // Simula event per a getEventCoordinates

  const timeDiff = now - lastTouchTime;
  const distX = Math.abs(x - lastTouchX);
  const distY = Math.abs(y - lastTouchY);

  if (
    timeDiff < CONFIG.DOUBLE_TAP_TIMEOUT &&
    distX < CONFIG.DOUBLE_TAP_MAX_DIST &&
    distY < CONFIG.DOUBLE_TAP_MAX_DIST
  ) {
    // Doble Tap detectat
    event.preventDefault(); // Prevé zoom o altres accions
    clearCanvas();
    lastTouchTime = 0; // Reseteja per evitar triple tap accidental
  } else {
    // Emmagatzema per al pròxim tap
    lastTouchTime = now;
    lastTouchX = x;
    lastTouchY = y;
  }
}

/** Registra els esdeveniments del canvas (ratolí i tàctil). */
function initCanvasEvents() {
  if (!signatureCanvasElement) return;

  // Esdeveniments del Ratolí
  signatureCanvasElement.addEventListener("mousedown", startDrawing);
  signatureCanvasElement.addEventListener("mousemove", draw);
  signatureCanvasElement.addEventListener("mouseup", stopDrawing);
  signatureCanvasElement.addEventListener("mouseout", stopDrawing); // Atura si surt del canvas
  signatureCanvasElement.addEventListener("click", handleCanvasClick);

  // Esdeveniments Tàctils
  // Usem 'passive: false' per poder cridar preventDefault() a 'draw' i 'handleCanvasTouchEnd'
  signatureCanvasElement.addEventListener("touchstart", startDrawing, {
    passive: false,
  });
  signatureCanvasElement.addEventListener("touchmove", draw, {
    passive: false,
  });
  signatureCanvasElement.addEventListener("touchend", stopDrawing);
  signatureCanvasElement.addEventListener("touchcancel", stopDrawing); // Si el sistema cancel·la el toc
  signatureCanvasElement.addEventListener("touchend", handleCanvasTouchEnd, {
    passive: false,
  });
}

/** Obre el modal de signatura per a un objectiu específic ('person1' o 'person2'). */
function openSignatureModal(target) {
  if (!signatureModalElement || !canvasContext) return;
  // DESHABILITEM EL SWIPE DE PESTANYES
  setSwipeEnabled(false);

  currentSignatureTarget = target;

  // Actualitza títol del modal
  const titleElement = document.getElementById(DOM_IDS.TITLE);
  if (titleElement) {
    titleElement.textContent =
      target === "person1" ? TITLES.PERSON1 : TITLES.PERSON2;
  }

  // Mostra el modal
  signatureModalElement.style.display = "block";
  document.body.classList.add(CSS_CLASSES.MODAL_OPEN); // Evita scroll del fons

  // Prepara el canvas
  resizeCanvas(); // Assegura mida correcta
  clearCanvas();

  // Carrega signatura existent si n'hi ha
  const existingSignature =
    target === "person1" ? signatureConductor : signatureAjudant;
  if (existingSignature) {
    drawSignatureFromDataUrl(existingSignature);
  }

  // TODO (Accessibilitat): Moure el focus a dins del modal, possiblement al botó Acceptar/Cancel·lar.
  document.getElementById(DOM_IDS.ACCEPT_BTN)?.focus();
}

/** Tanca el modal de signatura. */
function closeSignatureModal() {
  if (!signatureModalElement) return;
  // >>> TORNEM A HABILITAR EL SWIPE DE PESTANYES <<<
  setSwipeEnabled(true);

  signatureModalElement.style.display = "none";
  document.body.classList.remove(CSS_CLASSES.MODAL_OPEN);
  currentSignatureTarget = null; // Reseteja l'objectiu
  // TODO (Accessibilitat): Retornar el focus a l'element que va obrir el modal.
  // Això requereix guardar una referència a l'element que el va obrir.
  (currentSignatureTarget === "person1"
    ? signPerson1Button
    : signPerson2Button
  )?.focus();
}

/** Comprova si el canvas està buit (transparent). */
function isCanvasEmpty() {
  if (!canvasContext || !signatureCanvasElement) return true;
  try {
    const pixelBuffer = new Uint32Array(
      canvasContext.getImageData(
        0,
        0,
        signatureCanvasElement.width,
        signatureCanvasElement.height
      ).data.buffer
    );
    // `some` és més eficient que iterar tot l'array si troba un píxel no transparent aviat
    return !pixelBuffer.some((color) => color !== 0);
  } catch (e) {
    console.error(
      "Error llegint les dades del canvas per comprovar si està buit:",
      e
    );
    return false; // Assumeix que no està buit en cas d'error
  }
}

/** Desa la signatura actual en la variable corresponent i tanca el modal. */
function acceptSignature() {
  if (!canvasContext || !signatureCanvasElement || !currentSignatureTarget)
    return;

  const isEmpty = isCanvasEmpty();
  const dataURL = isEmpty
    ? ""
    : signatureCanvasElement.toDataURL(CONFIG.IMAGE_FORMAT);

  let targetButton = null;
  if (currentSignatureTarget === "person1") {
    signatureConductor = dataURL;
    targetButton = signPerson1Button;
  } else if (currentSignatureTarget === "person2") {
    signatureAjudant = dataURL;
    targetButton = signPerson2Button;
  }

  updateSignatureUI(targetButton, !isEmpty);
  closeSignatureModal();
}

/** Dibuixa una signatura desada (DataURL) al canvas. */
function drawSignatureFromDataUrl(dataUrl) {
  if (!canvasContext || !dataUrl) return;
  const image = new Image();
  image.onload = () => {
    // Dibuixa la imatge escalant-la si cal (encara que resizeCanvas hauria d'ajustar)
    canvasContext.drawImage(
      image,
      0,
      0,
      signatureCanvasElement.width,
      signatureCanvasElement.height
    );
  };
  image.onerror = () => {
    console.error(
      "No s'ha pogut carregar la imatge de la signatura des de DataURL."
    );
  };
  image.src = dataUrl;
}

/** Actualitza l'aspecte del botó de signatura (icona, classe). */
function updateSignatureUI(button, hasSignature) {
  // 'hasSignature' és un booleà (true/false)
  if (!button) return;
  const icon = button.querySelector(".icon"); // Assumeix que la teva icona té la classe '.icon'
  if (!icon) return;

  if (hasSignature) {
    // Si HI HA signatura
    button.classList.add("signed"); // Afegeix una classe per a possibles estils addicionals
    icon.src = "assets/icons/signature_ok.svg"; // <<< Posa l'icona VERDA
  } else {
    // Si NO HI HA signatura
    button.classList.remove("signed");
    icon.src = "assets/icons/signature.svg"; // <<< Posa l'icona NORMAL (no verda)
  }
}

// --- Funcions Públiques / Exportades ---

/**
 * Inicialitza el servei de signatures: busca elements DOM i configura listeners.
 * @export
 */
export function initSignature() {
  // Cacheig d'elements DOM
  signatureModalElement = document.getElementById(DOM_IDS.MODAL);
  signatureCanvasElement = document.getElementById(DOM_IDS.CANVAS);
  const signatureCancelBtn = document.getElementById(DOM_IDS.CANCEL_BTN);
  const signatureAcceptBtn = document.getElementById(DOM_IDS.ACCEPT_BTN);
  signPerson1Button = document.getElementById(DOM_IDS.SIGN_PERSON1_BTN);
  signPerson2Button = document.getElementById(DOM_IDS.SIGN_PERSON2_BTN);

  // Comprovació d'elements essencials
  if (
    !signatureModalElement ||
    !signatureCanvasElement ||
    !signatureCancelBtn ||
    !signatureAcceptBtn ||
    !signPerson1Button ||
    !signPerson2Button
  ) {
    console.warn(
      "Signature Service: Falten un o més elements del DOM necessaris. La funcionalitat pot estar incompleta."
    );
    return; // Atura si falten elements clau
  }

  // Configura canvas i listeners
  resizeCanvas(); // Crida inicial
  initCanvasEvents();

  // Listeners dels botons del modal
  signatureCancelBtn.addEventListener("click", closeSignatureModal);
  signatureAcceptBtn.addEventListener("click", acceptSignature);

  // Listeners dels botons principals per obrir el modal
  signPerson1Button.addEventListener("click", () =>
    openSignatureModal("person1")
  );
  signPerson2Button.addEventListener("click", () =>
    openSignatureModal("person2")
  );

  // Listener per tancar el modal clicant fora (al fons semitransparent)
  signatureModalElement.addEventListener("click", (event) => {
    // Tanca només si es clica directament sobre el fons del modal, no sobre el contingut
    if (event.target === signatureModalElement) {
      closeSignatureModal();
    }
  });

  // Listener per redimensionar el canvas si la finestra canvia de mida
  // Podem afegir un debounce aquí si el resize és molt freqüent o costós
  window.addEventListener("resize", debounce(resizeCanvas, 150));

  // Listener per tancar amb tecla 'Escape' (Accessibilitat)
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      signatureModalElement.style.display === "block"
    ) {
      closeSignatureModal();
    }
  });

  console.log("Signature Service inicialitzat.");
  // Inicialitza la UI dels botons per si ja hi ha signatures (p.ex., carregades de localStorage)
  updateSignatureIcons();
}

/** Retorna la signatura del conductor (DataURL base64). */
export function getSignatureConductor() {
  return signatureConductor;
}

/** Retorna la signatura de l'ajudant (DataURL base64). */
export function getSignatureAjudant() {
  return signatureAjudant;
}

/** Estableix la signatura del conductor (p.ex., al carregar dades). */
export function setSignatureConductor(value) {
  signatureConductor = value || ""; // Assegura que és string buit si és null/undefined
  updateSignatureUI(signPerson1Button, !!signatureConductor); // Actualitza UI
}

/** Estableix la signatura de l'ajudant (p.ex., al carregar dades). */
export function setSignatureAjudant(value) {
  signatureAjudant = value || "";
  updateSignatureUI(signPerson2Button, !!signatureAjudant); // Actualitza UI
}

/**
 * Actualitza les icones de tots els botons de signatura segons l'estat actual.
 * Útil per cridar després de carregar dades inicials.
 * @export
 */
export function updateSignatureIcons() {
  updateSignatureUI(signPerson1Button, !!signatureConductor);
  updateSignatureUI(signPerson2Button, !!signatureAjudant);
}

// Incloem debounce aquí o l'importem des d'utils si és compartit
/** Funció Debounce */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
