/**
 * @file signatureService.js
 * @description Gestiona signatures via canvas en modal.
 * @module signatureService
 */

import { setSwipeEnabled } from "../ui/tabs.js";
import { revalidateFormState } from "./formService.js";

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
  MODAL_OPEN: "modal-open",
  SIGNED: "signed",
};

const CONFIG = {
  LINE_WIDTH: 2,
  LINE_CAP: "round",
  STROKE_STYLE: "#000000",
  IMAGE_FORMAT: "image/png",
  DOUBLE_CLICK_TIMEOUT: 300,
  DOUBLE_TAP_TIMEOUT: 300,
  DOUBLE_TAP_MAX_DIST: 20,
};

const ICONS = {
  SIGNATURE_PENDING: "assets/icons/signature.svg",
  SIGNATURE_OK: "assets/icons/signature_ok.svg",
};

const TITLES = {
  PERSON1: "Firma del conductor",
  PERSON2: "Firma del ayudante",
};

// --- Classe Principal ---
class SignatureService {
  constructor() {
    this.signatureConductor = "";
    this.signatureAjudant = "";
    this.currentSignatureTarget = null;
    this.isDrawing = false;
    this.canvasContext = null;
    this.signatureCanvasElement = null;
    this.signatureModalElement = null;
    this.signPerson1Button = null;
    this.signPerson2Button = null;
    this.hasUserDrawn = false;

    this.lastTouchTime = 0;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.clickCount = 0;
    this.clickTimer = null;
  }

  /**
   * Inicialitza el servei.
   * @export
   */
  init() {
    this.signatureModalElement = document.getElementById(DOM_IDS.MODAL);
    this.signatureCanvasElement = document.getElementById(DOM_IDS.CANVAS);
    const signatureCancelBtn = document.getElementById(DOM_IDS.CANCEL_BTN);
    const signatureAcceptBtn = document.getElementById(DOM_IDS.ACCEPT_BTN);
    this.signPerson1Button = document.getElementById(DOM_IDS.SIGN_PERSON1_BTN);
    this.signPerson2Button = document.getElementById(DOM_IDS.SIGN_PERSON2_BTN);

    if (
      !this.signatureModalElement ||
      !this.signatureCanvasElement ||
      !signatureCancelBtn ||
      !signatureAcceptBtn ||
      !this.signPerson1Button ||
      !this.signPerson2Button
    )
      return;

    this.resizeCanvas();
    this.initCanvasEvents();

    signatureCancelBtn.addEventListener(
      "click",
      this.closeSignatureModal.bind(this)
    );
    signatureAcceptBtn.addEventListener(
      "click",
      this.acceptSignature.bind(this)
    );

    this.signPerson1Button.addEventListener("click", () =>
      this.openSignatureModal("person1")
    );
    this.signPerson2Button.addEventListener("click", () =>
      this.openSignatureModal("person2")
    );

    this.signatureModalElement.addEventListener("click", (event) => {
      if (event.target === this.signatureModalElement)
        this.closeSignatureModal();
    });

    window.addEventListener(
      "resize",
      this.debounce(this.resizeCanvas.bind(this), 150)
    );

    document.addEventListener("keydown", (event) => {
      if (
        event.key === "Escape" &&
        this.signatureModalElement.style.display === "block"
      )
        this.closeSignatureModal();
    });

    this.updateSignatureIcons();
  }

  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  resizeCanvas() {
    if (
      !this.signatureCanvasElement ||
      !this.signatureCanvasElement.parentElement
    )
      return;
    const container = this.signatureCanvasElement.parentElement;
    if (!this.canvasContext)
      this.canvasContext = this.signatureCanvasElement.getContext("2d", {
        willReadFrequently: true,
      });
    if (!this.canvasContext) return;

    this.signatureCanvasElement.width = container.offsetWidth;
    this.signatureCanvasElement.height = container.offsetHeight;

    this.canvasContext.lineWidth = CONFIG.LINE_WIDTH;
    this.canvasContext.lineCap = CONFIG.LINE_CAP;
    this.canvasContext.strokeStyle = CONFIG.STROKE_STYLE;
  }

  clearCanvas() {
    if (!this.canvasContext || !this.signatureCanvasElement) return;
    this.canvasContext.clearRect(
      0,
      0,
      this.signatureCanvasElement.width,
      this.signatureCanvasElement.height
    );
    this.hasUserDrawn = false;
  }

  getEventCoordinates(event) {
    if (!this.signatureCanvasElement) return { x: 0, y: 0 };
    const rect = this.signatureCanvasElement.getBoundingClientRect();
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

  startDrawing(event) {
    if (!this.canvasContext) return;
    this.isDrawing = true;
    this.hasUserDrawn = true;
    this.canvasContext.beginPath();
    const { x, y } = this.getEventCoordinates(event);
    this.canvasContext.moveTo(x, y);
  }

  draw(event) {
    if (!this.isDrawing || !this.canvasContext) return;
    event.preventDefault();
    const { x, y } = this.getEventCoordinates(event);
    this.canvasContext.lineTo(x, y);
    this.canvasContext.stroke();
  }

  stopDrawing() {
    if (!this.isDrawing || !this.canvasContext) return;
    this.isDrawing = false;
  }

  handleCanvasClick(event) {
    this.clickCount++;
    if (this.clickCount === 1) {
      this.clickTimer = setTimeout(
        () => (this.clickCount = 0),
        CONFIG.DOUBLE_CLICK_TIMEOUT
      );
    } else if (this.clickCount === 2) {
      clearTimeout(this.clickTimer);
      this.clickCount = 0;
      event.preventDefault();
      this.clearCanvas();
    }
  }

  handleCanvasTouchEnd(event) {
    if (event.touches.length > 0) return;
    const now = Date.now();
    const touch = event.changedTouches[0];
    if (!touch) return;
    const { x, y } = this.getEventCoordinates({
      clientX: touch.clientX,
      clientY: touch.clientY,
    });
    const timeDiff = now - this.lastTouchTime;
    const distX = Math.abs(x - this.lastTouchX);
    const distY = Math.abs(y - this.lastTouchY);

    if (
      timeDiff < CONFIG.DOUBLE_TAP_TIMEOUT &&
      distX < CONFIG.DOUBLE_TAP_MAX_DIST &&
      distY < CONFIG.DOUBLE_TAP_MAX_DIST
    ) {
      event.preventDefault();
      this.clearCanvas();
      this.lastTouchTime = 0;
    } else {
      this.lastTouchTime = now;
      this.lastTouchX = x;
      this.lastTouchY = y;
    }
  }

  initCanvasEvents() {
    if (!this.signatureCanvasElement) return;

    this.signatureCanvasElement.addEventListener(
      "mousedown",
      this.startDrawing.bind(this)
    );
    this.signatureCanvasElement.addEventListener(
      "mousemove",
      this.draw.bind(this)
    );
    this.signatureCanvasElement.addEventListener(
      "mouseup",
      this.stopDrawing.bind(this)
    );
    this.signatureCanvasElement.addEventListener(
      "mouseout",
      this.stopDrawing.bind(this)
    );
    this.signatureCanvasElement.addEventListener(
      "click",
      this.handleCanvasClick.bind(this)
    );

    this.signatureCanvasElement.addEventListener(
      "touchstart",
      this.startDrawing.bind(this),
      { passive: false }
    );
    this.signatureCanvasElement.addEventListener(
      "touchmove",
      this.draw.bind(this),
      { passive: false }
    );
    this.signatureCanvasElement.addEventListener(
      "touchend",
      this.stopDrawing.bind(this)
    );
    this.signatureCanvasElement.addEventListener(
      "touchcancel",
      this.stopDrawing.bind(this)
    );
    this.signatureCanvasElement.addEventListener(
      "touchend",
      this.handleCanvasTouchEnd.bind(this),
      { passive: false }
    );
  }

  openSignatureModal(target) {
    if (!this.signatureModalElement || !this.canvasContext) return;
    setSwipeEnabled(false);
    this.currentSignatureTarget = target;

    const titleElement = document.getElementById(DOM_IDS.TITLE);
    if (titleElement)
      titleElement.textContent =
        target === "person1" ? TITLES.PERSON1 : TITLES.PERSON2;

    this.signatureModalElement.style.display = "block";
    document.body.classList.add(CSS_CLASSES.MODAL_OPEN);

    this.resizeCanvas();
    this.clearCanvas();

    const existingSignature =
      target === "person1" ? this.signatureConductor : this.signatureAjudant;
    if (existingSignature) this.drawSignatureFromDataUrl(existingSignature);

    document.getElementById(DOM_IDS.ACCEPT_BTN)?.focus();
  }

  closeSignatureModal() {
    if (!this.signatureModalElement) return;
    setSwipeEnabled(true);
    this.signatureModalElement.style.display = "none";
    document.body.classList.remove(CSS_CLASSES.MODAL_OPEN);
    this.currentSignatureTarget = null;
    (this.currentSignatureTarget === "person1"
      ? this.signPerson1Button
      : this.signPerson2Button
    )?.focus();
  }

  isCanvasEmpty() {
    if (!this.canvasContext || !this.signatureCanvasElement) return true;
    try {
      const pixelBuffer = new Uint32Array(
        this.canvasContext.getImageData(
          0,
          0,
          this.signatureCanvasElement.width,
          this.signatureCanvasElement.height
        ).data.buffer
      );
      return !pixelBuffer.some((color) => color !== 0);
    } catch (e) {
      return false;
    }
  }

  acceptSignature() {
    if (
      !this.canvasContext ||
      !this.signatureCanvasElement ||
      !this.currentSignatureTarget
    )
      return;

    const isEmpty = this.isCanvasEmpty();
    const dataURL = isEmpty
      ? ""
      : this.signatureCanvasElement.toDataURL(CONFIG.IMAGE_FORMAT);

    let targetButton = null;
    if (this.currentSignatureTarget === "person1") {
      this.signatureConductor = dataURL;
      targetButton = this.signPerson1Button;
    } else if (this.currentSignatureTarget === "person2") {
      this.signatureAjudant = dataURL;
      targetButton = this.signPerson2Button;
    }

    this.updateSignatureUI(targetButton, !isEmpty);
    this.closeSignatureModal();
    revalidateFormState();
  }

  drawSignatureFromDataUrl(dataUrl) {
    if (!this.canvasContext || !dataUrl) return;
    const image = new Image();
    image.onload = () =>
      this.canvasContext.drawImage(
        image,
        0,
        0,
        this.signatureCanvasElement.width,
        this.signatureCanvasElement.height
      );
    image.onerror = () => {};
    image.src = dataUrl;
  }

  updateSignatureUI(button, hasSignature) {
    if (!button) return;
    const icon = button.querySelector(".icon");
    if (!icon) return;

    button.classList.toggle(CSS_CLASSES.SIGNED, hasSignature);
    icon.src = hasSignature ? ICONS.SIGNATURE_OK : ICONS.SIGNATURE_PENDING;
  }

  updateSignatureIcons() {
    this.updateSignatureUI(this.signPerson1Button, !!this.signatureConductor);
    this.updateSignatureUI(this.signPerson2Button, !!this.signatureAjudant);
  }

  getSignatureConductor() {
    return this.signatureConductor;
  }

  getSignatureAjudant() {
    return this.signatureAjudant;
  }

  setSignatureConductor(value) {
    this.signatureConductor = value || "";
    this.updateSignatureUI(this.signPerson1Button, !!this.signatureConductor);
  }

  setSignatureAjudant(value) {
    this.signatureAjudant = value || "";
    this.updateSignatureUI(this.signPerson2Button, !!this.signatureAjudant);
  }
}

const signatureService = new SignatureService();
export const initSignature = () => signatureService.init();
export const getSignatureConductor = () =>
  signatureService.getSignatureConductor();
export const getSignatureAjudant = () => signatureService.getSignatureAjudant();
export const setSignatureConductor = (value) =>
  signatureService.setSignatureConductor(value);
export const setSignatureAjudant = (value) =>
  signatureService.setSignatureAjudant(value);
export const updateSignatureIcons = () =>
  signatureService.updateSignatureIcons();
