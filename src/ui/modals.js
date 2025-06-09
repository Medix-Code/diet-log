/**
 * @file modals.js
 * @description Gestiona l'obertura, tancament i contingut de diversos modals de l'aplicació.
 * @module modals
 */

// Importacions de Serveis i Utilitats
import { loadDietById, deleteDietHandler } from "../services/dietService.js"; // Serveis per a accions
import { getDietDisplayInfo, capitalizeFirstLetter } from "../utils/utils.js"; // Utilitats per formatar
import { getAllDiets } from "../db/indexedDbDietRepository.js"; // Accés directe a BD per llistar

// --- Constants ---
const CSS_CLASSES = {
  MODAL_VISIBLE: "visible", // Classe per fer visible un modal (si s'usa classList)
  MODAL_OPEN_BODY: "modal-open", // Classe per al body
  HIDDEN: "hidden",
  DIET_ITEM: "diet-item",
  DIET_DATE: "diet-date",
  DIET_ICONS: "diet-icons",
  DIET_DELETE_BTN: "diet-delete", // Classe específica botó eliminar dieta
  DIET_LOAD_BTN: "diet-load", // Classe específica botó carregar dieta
  LIST_ITEM_BTN: "list-item-btn", // Classe base per botons de llista
  LIST_ITEM_BTN_LOAD: "list-item-btn--load", // Modificador
  LIST_ITEM_BTN_DELETE: "list-item-btn--delete", // Modificador
};
const DOM_IDS = {
  // Modals Específics
  DIET_MODAL: "diet-modal",
  DIET_OPTIONS_LIST: "diet-options",
  NO_DIETS_TEXT: "no-diets-text",
  CONFIRM_MODAL: "confirm-modal",
  CONFIRM_MESSAGE: "confirm-message",
  CONFIRM_TITLE: ".modal-title", // Selector dins del confirm modal
  CONFIRM_YES_BTN: "confirm-yes",
  CONFIRM_NO_BTN: "confirm-no",
  // Altres modals (es gestionen per ID o selectors genèrics)
  ABOUT_MODAL: "about-modal",
  SIGNATURE_MODAL: "signature-modal",
  DOTACIO_MODAL: "dotacio-modal",
  CAMERA_GALLERY_MODAL: "camera-gallery-modal",
};
const SELECTORS = {
  MODAL: ".modal", // Selector genèric per identificar modals
  MODAL_CLOSE_BTN: ".close-modal, .close-modal-btn", // Qualsevol botó de tancar
  MODAL_TRIGGER: 'a[href^="#"]', // Enllaços que apunten a IDs (per setupModalGenerics)
  FOCUSABLE_ELEMENTS:
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', // Elements enfocables
};
const DATA_ATTRIBUTES = {
  DIET_ID: "data-diet-id",
  DIET_DATE: "data-diet-date",
  DIET_TYPE: "data-diet-type",
};

// --- Variables d'Estat / Cache ---
let dietModalElement = null;
let dietOptionsListElement = null;
let noDietsTextElement = null;
let confirmModalElement = null;
let confirmMsgElement = null;
let confirmTitleElement = null;
let confirmYesBtn = null;
let confirmNoBtn = null;
let currentConfirmResolve = null; // Funció resolve de la promesa de confirmació actual
let activeModalElement = null; // Referència al modal obert actualment
let previousActiveElement = null; // Element que tenia el focus abans d'obrir el modal
let currentOutsideClickListener = null; // Referència al listener de clic fora actiu
let currentEscapeKeyListener = null; // Referència al listener d'Escape actiu

// --- Funcions Privades ---

/** Obre un modal genèric. */
function _openGenericModal(modalElement) {
  // Comprovació 1: El modal a obrir existeix?
  if (!modalElement) {
    console.error("Intent d'obrir un modal que no existeix.");
    return;
  }

  // Comprovació 2: Ja hi ha un modal actiu?
  // EXCEPCIÓ: Permetem obrir el modal de confirmació (#confirm-modal)
  // fins i tot si un altre modal genèric ja està actiu.
  if (
    activeModalElement &&
    activeModalElement.id !== modalElement.id &&
    modalElement.id !== DOM_IDS.CONFIRM_MODAL
  ) {
    console.warn(
      `S'ha intentat obrir el modal #${modalElement.id} mentre #${activeModalElement.id} ja estava actiu (i no és confirmació). Acció bloquejada.`
    );
    return; // Bloqueja l'obertura si ja n'hi ha un altre (i no és el de confirmació)
  }

  // Si estem obrint un modal NOU (no el de confirmació sobre un altre),
  // guardem l'element que tenia el focus abans.
  if (!activeModalElement) {
    previousActiveElement = document.activeElement;
  }
  // Si ja hi havia un modal i obrim el de confirmació, mantenim el previousActiveElement
  // del modal original per poder retornar-hi si es cancel·la tot.

  // *** Estableix el modal actual com l'ACTIU ***
  // Si obrim confirmació sobre un altre, 'activeModalElement' ara serà el de confirmació.
  activeModalElement = modalElement;
  console.log("[Open] Active Modal SET to:", activeModalElement?.id);
  modalElement.style.display = "block"; // O 'flex'
  document.body.classList.add(CSS_CLASSES.MODAL_OPEN_BODY);

  // Defineix i afegeix listeners globals per clic fora i Escape
  // Només si no estem ja escoltant (evita duplicats si hi ha error)
  if (!currentOutsideClickListener) {
    currentOutsideClickListener = (event) => {
      if (event.target === activeModalElement) {
        // Només si clica l'overlay directe
        console.log(
          `Clic fora detectat per al modal #${activeModalElement?.id}`
        );
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
        console.log(
          `Tecla Escape detectada per al modal #${activeModalElement?.id}`
        );
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

  // Mou el focus
  const firstFocusable = modalElement.querySelector(
    SELECTORS.FOCUSABLE_ELEMENTS
  );
  firstFocusable?.focus();

  console.log(`Modal obert: #${modalElement.id}`);
}

/** Tanca el modal genèric actualment actiu. */
function _closeGenericModal() {
  if (!activeModalElement) return;
  const modalToClose = activeModalElement;
  // ... (Neteja listeners globals: clic fora, escape) ...
  if (currentOutsideClickListener) {
    /* ... remove listener ... */
  }
  if (currentEscapeKeyListener) {
    /* ... remove listener ... */
  }

  modalToClose.style.display = "none";
  document.body.classList.remove(CSS_CLASSES.MODAL_OPEN_BODY);
  console.log(`Modal tancat: #${modalToClose.id}`);
  activeModalElement = null; // <<-- Reseteja QUIN modal està actiu

  // Només retornem el focus si no estem enmig d'una operació de confirmació
  // (perquè volem que el focus torni DESPRÉS de tancar el modal original)
  if (!currentConfirmResolve) {
    // Si no hi ha una promesa de confirmació pendent
    previousActiveElement?.focus();
    previousActiveElement = null;
  }
  // Si currentConfirmResolve existeix, el focus es gestionarà quan es tanqui el modal original
}

/** Crea un element de llista (DOM) per a una dieta. */
function _createDietListItem(diet) {
  const { ddmmaa, franjaText } = getDietDisplayInfo(diet.date, diet.dietType);
  const dietItem = document.createElement("div");
  dietItem.className = CSS_CLASSES.DIET_ITEM;

  const dateSpan = document.createElement("span");
  dateSpan.className = CSS_CLASSES.DIET_DATE;
  dateSpan.textContent = `${ddmmaa} - ${capitalizeFirstLetter(franjaText)}`;

  const iconsContainer = document.createElement("div");
  iconsContainer.className = CSS_CLASSES.DIET_ICONS;

  const deleteBtn = document.createElement("button");
  deleteBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} ${CSS_CLASSES.LIST_ITEM_BTN_DELETE} ${CSS_CLASSES.DIET_DELETE_BTN}`;
  deleteBtn.setAttribute("aria-label", `Eliminar dieta ${ddmmaa}`);
  // Afegim text ocult per accessibilitat, la icona va per CSS si s'usa :before/:after o directament com img
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

/** Gestiona clics dins la llista de dietes (delegació). */
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
    console.log("Confirmació rebuda:", confirmed); //

    if (confirmed) {
      console.log("Entrant a carregar dieta...");
      // Cridem loadDietById. Aquesta funció (a dietService.js)
      // és la responsable de tancar el modal SI la càrrega té èxit.
      try {
        await loadDietById(dietId); // Esperem per si llança error
        // Si loadDietById té èxit, ja haurà cridat a closeDietModal internament.
        console.log(`Intent de càrrega completat per a la dieta ${dietId}.`);
      } catch (error) {
        // Si loadDietById falla, el modal probablement no s'haurà tancat.
        // Podríem decidir tancar-lo aquí o deixar-lo obert.
        // Per ara, el deixem obert per mantenir la consistència amb l'eliminació.
        console.error(
          `Error durant la crida a loadDietById per a ${dietId}:`,
          error
        );
      }
    }
  } else if (deleteButton) {
    event.stopPropagation();
    const dietId = deleteButton.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    const dietDate = deleteButton.getAttribute(DATA_ATTRIBUTES.DIET_DATE);
    const dietType = deleteButton.getAttribute(DATA_ATTRIBUTES.DIET_TYPE);
    if (dietId) {
      // deleteDietHandler (a dietService.js) demana confirmació
      // i després actualitza la llista (displayDietOptions), però NO tanca el modal.
      // Això ja fa el que volem.
      deleteDietHandler(dietId, dietDate, dietType);
    }
  }
}

/** Traps focus inside the confirm modal. */
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

/** Neteja listeners específics del modal de confirmació (Sí/No i Trap Focus). */
function _cleanupConfirmModalListeners() {
  if (confirmNoBtn) confirmNoBtn.removeEventListener("click", _handleConfirmNo);
  if (confirmYesBtn)
    confirmYesBtn.removeEventListener("click", _handleConfirmYes);
  document.removeEventListener("keydown", _trapConfirmFocus);
  // Ja no netegem currentConfirmResolve aquí, es fa després de resoldre
  // console.log("Listeners interns del modal de confirmació netejats.");
}

/** Gestiona clic "Sí". */
function _handleConfirmYes() {
  if (currentConfirmResolve) currentConfirmResolve(true);
  _closeConfirmModalOnly(); // Només tanca el modal de confirmació visualment
  currentConfirmResolve = null; // Reseteja la promesa ARA
}

/** Gestiona clic "No". */
function _handleConfirmNo() {
  if (currentConfirmResolve) currentConfirmResolve(false);
  _closeConfirmModalOnly(); // Només tanca el modal de confirmació visualment
  currentConfirmResolve = null; // Reseteja la promesa ARA
}

/** Tanca el modal de confirmació i neteja els seus listeners interns. */
function _closeConfirmModal() {
  _cleanupConfirmModalListeners(); // Neteja Sí/No/Trap
  _closeGenericModal(); // Crida genèrica per ocultar i netejar listeners globals
}

/** Tanca NOMÉS el modal de confirmació visualment i neteja els seus listeners interns.
 *  NO crida a _closeGenericModal per no resetejar activeModalElement ni listeners globals.
 */
function _closeConfirmModalOnly() {
  if (!confirmModalElement) return;
  confirmModalElement.style.display = "none"; // Oculta el modal de confirmació
  _cleanupConfirmModalListeners(); // Neteja listeners interns (Sí/No/TrapFocus)
  console.log(
    "Modal de confirmació tancat visualment i listeners interns netejats."
  );
  // NO reseteja activeModalElement aquí
  // NO treu la classe del body aquí
  // NO treu listeners globals aquí
  // NO retorna el focus aquí
}

// --- Funcions Públiques / Exportades ---

/**
 * Configura els listeners per a modals genèrics que s'obren amb enllaços `href="#modal-id"`.
 * També inicialitza el cache d'elements per al modal de confirmació.
 * @export
 */
export function setupModalGenerics() {
  // Cacheig inicial elements modal de confirmació
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
      console.error(
        "Falten elements dins del modal de confirmació. Funcionalitat desactivada."
      );
      confirmModalElement = null;
    }
    // No afegim listener de clic fora aquí, es gestiona globalment quan s'obre
  } else {
    console.warn("Modal de confirmació no trobat durant la inicialització.");
  }

  // Configura triggers genèrics (com el botó "About")
  const modalTriggers = document.querySelectorAll(SELECTORS.MODAL_TRIGGER);
  modalTriggers.forEach((trigger) => {
    try {
      const modalId = trigger.getAttribute("href")?.substring(1);
      if (!modalId) return;
      const targetModal = document.getElementById(modalId);

      // Assegura't que és un modal que volem gestionar aquí
      if (targetModal && targetModal.matches(SELECTORS.MODAL)) {
        // Evita afegir listeners múltiples
        if (trigger.dataset.modalSetup === "true") return;
        trigger.dataset.modalSetup = "true";

        trigger.addEventListener("click", (event) => {
          event.preventDefault();
          // Comprova si ja hi ha un modal obert abans d'obrir-ne un altre
          if (activeModalElement && activeModalElement !== targetModal) {
            console.warn(
              `S'ha intentat obrir el modal #${modalId} mentre #${activeModalElement.id} estava actiu.`
            );
            // Opcional: podries tancar l'antic primer?
            // _closeGenericModal();
            // setTimeout(() => _openGenericModal(targetModal), 10); // Petita espera
            return; // Per ara, simplement no obrim el nou
          }
          _openGenericModal(targetModal);
        });

        // Configura botons de tancar interns
        const closeButtons = targetModal.querySelectorAll(
          SELECTORS.MODAL_CLOSE_BTN
        );
        closeButtons.forEach((btn) => {
          if (btn.dataset.modalCloseSetup === "true") return;
          btn.dataset.modalCloseSetup = "true";
          btn.addEventListener("click", () => _closeGenericModal()); // Tanca l'actiu
        });
      }
    } catch (error) {
      console.error(
        `Error configurant trigger per a modal: ${trigger.getAttribute(
          "href"
        )}`,
        error
      );
    }
  });
  console.log("Listeners per a modals genèrics configurats.");
}

/** Obre el modal de gestió de dietes. */
export function openDietModal() {
  if (!dietModalElement) {
    // Cacheig i listener només la primera vegada
    dietModalElement = document.getElementById(DOM_IDS.DIET_MODAL);
    dietOptionsListElement = document.getElementById(DOM_IDS.DIET_OPTIONS_LIST);
    noDietsTextElement = document.getElementById(DOM_IDS.NO_DIETS_TEXT);

    // ▶︎ nou botó “Cerrar”
    const closeDietBtn = document.getElementById("close-diet-modal");
    if (closeDietBtn && !closeDietBtn.dataset.listenerAttached) {
      closeDietBtn.dataset.listenerAttached = "true";
      closeDietBtn.addEventListener("click", closeDietModal);
    }

    if (dietOptionsListElement) {
      dietOptionsListElement.addEventListener("click", _handleDietListClick);
    } else {
      console.error(
        "El contenidor de la llista de dietes (#diet-options) no s'ha trobat."
      );
      dietModalElement = null;
    }
  }
  if (dietModalElement) {
    _openGenericModal(dietModalElement);
    displayDietOptions();
  }
}

/** Tanca el modal de gestió de dietes (crida la funció genèrica). */
export function closeDietModal() {
  // Comprova si el modal actiu és realment el de dietes abans de tancar
  if (activeModalElement && activeModalElement.id === DOM_IDS.DIET_MODAL) {
    _closeGenericModal();
  } else {
    console.warn(
      "S'ha intentat cridar closeDietModal quan no era el modal actiu."
    );
  }
}

/** Mostra les opcions de dietes desades dins del seu contenidor al modal. */
export async function displayDietOptions() {
  if (!dietOptionsListElement)
    dietOptionsListElement = document.getElementById(DOM_IDS.DIET_OPTIONS_LIST);
  if (!noDietsTextElement)
    noDietsTextElement = document.getElementById(DOM_IDS.NO_DIETS_TEXT);
  if (!dietOptionsListElement || !noDietsTextElement) {
    console.error("Elements DOM per a opcions de dietes no disponibles.");
    return;
  }
  dietOptionsListElement.innerHTML = "";
  try {
    const savedDiets = await getAllDiets();
    if (!savedDiets || savedDiets.length === 0) {
      dietOptionsListElement.classList.add(CSS_CLASSES.HIDDEN);
      noDietsTextElement.classList.remove(CSS_CLASSES.HIDDEN);
      noDietsTextElement.textContent = "No hay dietas guardadas.";
    } else {
      dietOptionsListElement.classList.remove(CSS_CLASSES.HIDDEN);
      noDietsTextElement.classList.add(CSS_CLASSES.HIDDEN);
      // Ordenar
      savedDiets.sort((a, b) => new Date(b.date) - new Date(a.date));
      savedDiets.forEach((diet) => {
        const listItem = _createDietListItem(diet);
        dietOptionsListElement.appendChild(listItem);
      });
    }
  } catch (error) {
    console.error("Error obtenint o mostrant les dietes desades:", error);
    dietOptionsListElement.classList.add(CSS_CLASSES.HIDDEN);
    noDietsTextElement.classList.remove(CSS_CLASSES.HIDDEN);
    noDietsTextElement.textContent = "Error al cargar las dietas.";
  }
}

/** Mostra un modal de confirmació reutilitzable. */
export function showConfirmModal(message, title = "Confirmar acció") {
  if (!confirmModalElement) {
    /* ... error ... */
  }
  if (currentConfirmResolve) {
    /* ... warning ... */
  } // Aquesta comprovació encara és útil

  return new Promise((resolve) => {
    currentConfirmResolve = resolve;
    confirmTitleElement.textContent = title;
    confirmMsgElement.textContent = message;

    confirmYesBtn.addEventListener("click", _handleConfirmYes);
    confirmNoBtn.addEventListener("click", _handleConfirmNo);
    document.addEventListener("keydown", _trapConfirmFocus);

    // *** IMPORTANT: Obre el modal de confirmació SENSE canviar activeModalElement ***
    // Encara considerem que el modal subjacent és l'actiu principalment.
    confirmModalElement.style.display = "block"; // Mostra directament
    // NO cridem _openGenericModal aquí per no canviar activeModalElement
    // Podríem afegir el listener d'escape específic per a confirmació si cal
    // document.addEventListener('keydown', _handleConfirmEscapeSpecific);
    console.log(
      "Modal de confirmació obert (sobre possible altre modal). Esperant resposta..."
    );
    confirmYesBtn.focus();
  });
}
