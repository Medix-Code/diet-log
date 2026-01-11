import { loadDietById, deleteDietHandler } from "../../services/dietService.js";
import { getAllDiets } from "../../db/indexedDbDietRepository.js";
import {
  getDietDisplayInfo,
  capitalizeFirstLetter,
} from "../../utils/utils.js";
import { downloadDietPDF } from "../../services/pdfService.js";
import {
  CSS_CLASSES,
  DATA_ATTRIBUTES,
  DOM_IDS,
  openModal,
  closeModal,
  getActiveModalElement,
} from "./modalManager.js";
import { logger } from "../../utils/logger.js";
import { openTrashModal } from "./trashModal.js";

const log = logger.withScope("Modals:Diet");

let dietModalElement = null;
let dietOptionsListElement = null;
let noDietsTextElement = null;
let isInitialized = false;

function ensureElements() {
  if (isInitialized) return true;
  dietModalElement = document.getElementById(DOM_IDS.DIET_MODAL);
  dietOptionsListElement = document.getElementById(DOM_IDS.DIET_OPTIONS_LIST);
  noDietsTextElement = document.getElementById(DOM_IDS.NO_DIETS_TEXT);

  if (!dietModalElement || !dietOptionsListElement || !noDietsTextElement) {
    log.warn("No s'han trobat els elements del modal de dietes.");
    return false;
  }

  const trashTrigger = document.getElementById("open-trash-modal");
  if (trashTrigger && !trashTrigger.dataset.modalPrepared) {
    trashTrigger.addEventListener("click", () => {
      closeDietModal();
      openTrashModal();
    });
    trashTrigger.dataset.modalPrepared = "true";
  }

  const closeDietBtn = document.getElementById("close-diet-modal");
  if (closeDietBtn && !closeDietBtn.dataset.modalPrepared) {
    closeDietBtn.addEventListener("click", () => closeModal(dietModalElement));
    closeDietBtn.dataset.modalPrepared = "true";
  }

  if (!dietOptionsListElement.dataset.modalPrepared) {
    dietOptionsListElement.addEventListener("click", handleDietListClick);
    dietOptionsListElement.dataset.modalPrepared = "true";
  }

  isInitialized = true;
  return true;
}

function formatTimeFromISO(isoTimestamp) {
  if (!isoTimestamp) return "";
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function createDietListItem(diet) {
  // ✅ FIX: Utilitzar diet.id directament (funciona amb dietes encriptades i no encriptades)
  const displayId = diet.id || "?????????";

  const { ddmmaa, franjaText } = getDietDisplayInfo(diet.date, diet.dietType);

  const dietItem = document.createElement("div");
  dietItem.className = CSS_CLASSES.DIET_ITEM;

  const dietItemContent = document.createElement("div");
  dietItemContent.className = "diet-item-content";

  const dateSpan = document.createElement("span");
  dateSpan.className = CSS_CLASSES.DIET_DATE;
  let displayText = ddmmaa;

  displayText += ` - ${capitalizeFirstLetter(franjaText)}`;
  dateSpan.textContent = displayText;

  const iconsContainer = document.createElement("div");
  iconsContainer.className = CSS_CLASSES.DIET_ICONS;

  const deleteReveal = document.createElement("div");
  deleteReveal.className = CSS_CLASSES.DIET_DELETE_REVEAL;

  // Seguretat XSS: usar createElement en lloc de innerHTML
  const deleteContent = document.createElement("div");
  deleteContent.className = "delete-reveal-content";

  const deleteIcon = document.createElement("img");
  deleteIcon.src = "assets/icons/delete.svg";
  deleteIcon.alt = "Eliminar";
  deleteIcon.className = "icon";

  const deleteText = document.createElement("span");
  deleteText.className = "delete-text";
  deleteText.textContent = "Eliminar dieta";

  deleteContent.appendChild(deleteIcon);
  deleteContent.appendChild(deleteText);
  deleteReveal.appendChild(deleteContent);

  const loadBtn = document.createElement("button");
  loadBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} ${CSS_CLASSES.LIST_ITEM_BTN_LOAD} ${CSS_CLASSES.DIET_LOAD_BTN}`;
  loadBtn.setAttribute("aria-label", `Editar dieta ${ddmmaa}`);

  // Seguretat XSS: usar createElement en lloc de innerHTML
  const loadIcon = document.createElement("img");
  loadIcon.src = "assets/icons/ic_edit.svg";
  loadIcon.alt = "";
  loadIcon.className = "icon";
  loadIcon.style.pointerEvents = "none"; // Evitar que la icona intercepti events

  const loadText = document.createElement("span");
  loadText.className = "btn-text visually-hidden";
  loadText.textContent = "Editar";
  loadText.style.pointerEvents = "none"; // Evitar que el text intercepti events

  loadBtn.appendChild(loadIcon);
  loadBtn.appendChild(loadText);

  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_ID, displayId);
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_DATE, diet.date);
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_TYPE, diet.dietType);

  // Prevenir que els botons activin el swipe-to-delete
  loadBtn.addEventListener("mousedown", (e) => e.stopPropagation());
  loadBtn.addEventListener("touchstart", (e) => e.stopPropagation(), {
    passive: true,
  });

  // Afegir listener de clic directament al botó per garantir que funcioni
  loadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const rawId = loadBtn.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    const dietDate = loadBtn.getAttribute(DATA_ATTRIBUTES.DIET_DATE);
    const dietType = loadBtn.getAttribute(DATA_ATTRIBUTES.DIET_TYPE);
    if (!rawId || !dietDate || !dietType) return;

    const { ddmmaa: dateStr, franjaText } = getDietDisplayInfo(
      dietDate,
      dietType
    );

    loadDietById(rawId)
      .then(() => {
        log.debug(`Dieta ${dateStr} carregada (${franjaText}).`);
        closeModal(dietModalElement);
      })
      .catch((error) => {
        log.error("Error en carregar la dieta:", error);
      });
  });

  const downloadBtn = document.createElement("button");
  downloadBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} diet-download`;
  downloadBtn.setAttribute(
    "aria-label",
    `Descarregar PDF de la dieta ${ddmmaa}`
  );

  // Seguretat XSS: usar createElement en lloc de innerHTML
  const downloadIcon = document.createElement("img");
  downloadIcon.src = "assets/icons/download_blue.svg";
  downloadIcon.alt = "";
  downloadIcon.className = "icon";
  downloadIcon.style.pointerEvents = "none"; // Evitar que la icona intercepti events

  const downloadText = document.createElement("span");
  downloadText.className = "btn-text visually-hidden";
  downloadText.textContent = "PDF";
  downloadText.style.pointerEvents = "none"; // Evitar que el text intercepti events

  downloadBtn.appendChild(downloadIcon);
  downloadBtn.appendChild(downloadText);

  downloadBtn.setAttribute(DATA_ATTRIBUTES.DIET_ID, displayId);

  // Prevenir que el botó PDF activi el swipe-to-delete
  downloadBtn.addEventListener("mousedown", (e) => e.stopPropagation());
  downloadBtn.addEventListener("touchstart", (e) => e.stopPropagation(), {
    passive: true,
  });

  // Afegir listener de clic directament al botó per garantir que funcioni
  downloadBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const dietId = downloadBtn.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    if (dietId) {
      downloadDietPDF(dietId);
    }
  });

  iconsContainer.appendChild(loadBtn);
  iconsContainer.appendChild(downloadBtn);

  dietItemContent.appendChild(dateSpan);
  dietItemContent.appendChild(iconsContainer);

  dietItem.appendChild(dietItemContent);
  dietItem.appendChild(deleteReveal);

  return dietItem;
}

function handleDietListClick(event) {
  const target = event.target;
  const loadButton = target.closest(`.${CSS_CLASSES.DIET_LOAD_BTN}`);
  const downloadButton = target.closest(".diet-download");

  if (loadButton) {
    event.stopPropagation();
    const rawId = loadButton.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    const dietDate = loadButton.getAttribute(DATA_ATTRIBUTES.DIET_DATE);
    const dietType = loadButton.getAttribute(DATA_ATTRIBUTES.DIET_TYPE);
    if (!rawId || !dietDate || !dietType) return;

    const { ddmmaa, franjaText } = getDietDisplayInfo(dietDate, dietType);

    loadDietById(rawId)
      .then(() => {
        log.debug(`Dieta ${ddmmaa} carregada (${franjaText}).`);
        closeModal(dietModalElement);
      })
      .catch((error) => {
        log.error("Error en carregar la dieta:", error);
      });
  } else if (downloadButton) {
    event.stopPropagation();
    event.preventDefault();
    const dietId = downloadButton.getAttribute(DATA_ATTRIBUTES.DIET_ID);
    if (dietId) {
      downloadDietPDF(dietId);
    }
  }
}

function updateDietListVisibility() {
  if (!dietOptionsListElement || !noDietsTextElement) return;

  const hasChildren = dietOptionsListElement.children.length > 0;
  dietOptionsListElement.classList.toggle(CSS_CLASSES.HIDDEN, !hasChildren);
  noDietsTextElement.classList.toggle(CSS_CLASSES.HIDDEN, hasChildren);
  if (!hasChildren) {
    noDietsTextElement.textContent = "No hay dietas guardadas.";
  }
}

function initMouseSwipeToDelete(dietItem, dietId, dietDate, dietType) {
  let startX = 0;
  let currentX = 0;
  let isDragging = false;
  let isDeleting = false;
  let isSwipeActive = false;

  // Handlers que s'afegiran/trauran dinàmicament
  const handleMouseMove = (event) => {
    if (!isSwipeActive) return;
    currentX = event.clientX;
    const diff = startX - currentX;
    if (diff > 10 && !isDragging) {
      isDragging = true;
      dietItem.classList.add(CSS_CLASSES.DIET_ITEM_SWIPING);
    }
    if (isDragging && diff > 10) {
      dietItem.style.transform = `translateX(-${Math.min(diff, 120)}px)`;
      event.preventDefault();
    }
  };

  const handleMouseUp = async () => {
    // Neteja dels listeners globals
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);

    if (!isSwipeActive || isDeleting) {
      isSwipeActive = false;
      isDragging = false;
      return;
    }

    const diff = startX - currentX;
    isSwipeActive = false;

    dietItem.classList.remove(CSS_CLASSES.DIET_ITEM_SWIPING);
    dietItem.style.transition = "transform 0.3s ease, opacity 0.3s ease";

    if (isDragging && diff > 50) {
      isDeleting = true;
      dietItem.style.transform = "translateX(-100%)";
      dietItem.style.opacity = "0";

      setTimeout(async () => {
        dietItem.remove();
        updateDietListVisibility();
        await deleteDietHandler(dietId, dietDate, dietType);
      }, 300);
    } else {
      dietItem.style.transform = "translateX(0)";
      dietItem.style.opacity = "1";
    }

    isDragging = false;
    setTimeout(() => {
      dietItem.style.transition = "";
      dietItem.style.opacity = "";
    }, 300);
  };

  dietItem.addEventListener("mousedown", (event) => {
    // ⛔ IGNORAR si el clic és dins de botons o elements interactius
    if (
      event.target.closest("button") ||
      event.target.closest(".diet-icons") ||
      event.target.closest(".list-item-btn") ||
      event.target.tagName === "BUTTON" ||
      event.target.tagName === "IMG" ||
      event.target.tagName === "SPAN"
    ) {
      return;
    }

    isSwipeActive = true;
    startX = event.clientX;
    currentX = startX;
    isDragging = false;

    // Afegir listeners globals NOMÉS quan s'inicia un swipe vàlid
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  });
}

function initSwipeToDelete(dietItem, dietId, dietDate, dietType) {
  let startX = 0;
  let currentX = 0;
  let isSwiping = false;
  let isDeleting = false;
  let isSwipeActive = false;

  const handleTouchMove = (event) => {
    if (!isSwipeActive) return;
    currentX = event.touches[0].clientX;
    const diff = startX - currentX;
    if (diff > 10 && !isSwiping) {
      isSwiping = true;
      dietItem.classList.add(CSS_CLASSES.DIET_ITEM_SWIPING);
      if (dietModalElement) dietModalElement.style.overflow = "hidden";
    }
    if (isSwiping && diff > 10) {
      dietItem.style.transform = `translateX(-${Math.min(diff, 120)}px)`;
      event.preventDefault();
      event.stopPropagation();
    }
  };

  const handleTouchEnd = async (event) => {
    // Neteja dels listeners
    dietItem.removeEventListener("touchmove", handleTouchMove);
    dietItem.removeEventListener("touchend", handleTouchEnd);

    if (!isSwipeActive || isDeleting) {
      isSwipeActive = false;
      isSwiping = false;
      if (dietModalElement) dietModalElement.style.overflow = "";
      return;
    }

    const diff = startX - currentX;
    isSwipeActive = false;

    dietItem.classList.remove(CSS_CLASSES.DIET_ITEM_SWIPING);
    dietItem.style.transition = "transform 0.3s ease, opacity 0.3s ease";

    if (isSwiping && diff > 50) {
      isDeleting = true;
      dietItem.style.transform = "translateX(-100%)";
      dietItem.style.opacity = "0";

      setTimeout(async () => {
        dietItem.remove();
        updateDietListVisibility();
        await deleteDietHandler(dietId, dietDate, dietType);
      }, 300);
    } else {
      dietItem.style.transform = "translateX(0)";
      dietItem.style.opacity = "1";
      if (dietModalElement) dietModalElement.style.overflow = "";
    }

    isSwiping = false;
    setTimeout(() => {
      dietItem.style.transition = "";
      dietItem.style.opacity = "";
    }, 300);

    event.stopPropagation();
  };

  dietItem.addEventListener(
    "touchstart",
    (event) => {
      // ⛔ IGNORAR si el touch és dins de botons o elements interactius
      if (
        event.target.closest("button") ||
        event.target.closest(".diet-icons") ||
        event.target.closest(".list-item-btn") ||
        event.target.tagName === "BUTTON" ||
        event.target.tagName === "IMG" ||
        event.target.tagName === "SPAN"
      ) {
        return;
      }

      isSwipeActive = true;
      startX = event.touches[0].clientX;
      currentX = startX;
      isSwiping = false;

      // Afegir listeners NOMÉS quan s'inicia un swipe vàlid
      dietItem.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      dietItem.addEventListener("touchend", handleTouchEnd);
    },
    { passive: false }
  );

  initMouseSwipeToDelete(dietItem, dietId, dietDate, dietType);
}

export function setupDietModal() {
  ensureElements();
}

export function openDietModal() {
  if (!ensureElements()) return;
  openModal(dietModalElement);
  displayDietOptions();
}

export function closeDietModal() {
  if (getActiveModalElement() !== dietModalElement) return;
  closeModal(dietModalElement);
}

export async function displayDietOptions() {
  if (!ensureElements()) return;

  dietOptionsListElement.innerHTML = "";
  try {
    const savedDiets = await getAllDiets();
    if (savedDiets.length === 0) {
      dietOptionsListElement.classList.add(CSS_CLASSES.HIDDEN);
      noDietsTextElement.classList.remove(CSS_CLASSES.HIDDEN);
      noDietsTextElement.textContent = "No hay dietas guardadas.";
      return;
    }

    dietOptionsListElement.classList.remove(CSS_CLASSES.HIDDEN);
    noDietsTextElement.classList.add(CSS_CLASSES.HIDDEN);

    savedDiets
      .slice()
      .sort((a, b) => {
        // Ordenar per date descendent (més recent primer)
        const dateComparison = new Date(b.date) - new Date(a.date);
        // Si tenen la mateixa data, ordenar per timeStampDiet descendent
        if (dateComparison === 0) {
          return new Date(b.timeStampDiet) - new Date(a.timeStampDiet);
        }
        return dateComparison;
      })
      .forEach((diet, index) => {
        const listItem = createDietListItem(diet);
        listItem.setAttribute("data-index", String(index));
        dietOptionsListElement.appendChild(listItem);
        initSwipeToDelete(listItem, diet.id, diet.date, diet.dietType);
      });
  } catch (error) {
    log.error("Error al carregar les dietes:", error);
    dietOptionsListElement.classList.add(CSS_CLASSES.HIDDEN);
    noDietsTextElement.classList.remove(CSS_CLASSES.HIDDEN);
    noDietsTextElement.textContent = "Error al cargar las dietas.";
  }
}

export function removeDietItemFromList(dietId) {
  if (!ensureElements()) return;

  const itemToRemove = dietOptionsListElement
    .querySelector(`[data-diet-id="${dietId}"]`)
    ?.closest(".diet-item");
  if (!itemToRemove) return;

  const currentHeight = `${dietOptionsListElement.scrollHeight}px`;
  dietOptionsListElement.style.height = currentHeight;

  itemToRemove.remove();

  requestAnimationFrame(() => {
    dietOptionsListElement.style.height = `${dietOptionsListElement.scrollHeight}px`;
  });

  updateDietListVisibility();
}

export function restoreDietItemToList(diet) {
  if (!ensureElements()) {
    displayDietOptions();
    return;
  }

  const originalIndex = diet.index || 0;
  const restoredItem = createDietListItem(diet);
  restoredItem.style.opacity = "0";
  restoredItem.style.transform = "translateX(-100%)";

  const sibling = dietOptionsListElement.children[originalIndex];
  if (sibling) {
    dietOptionsListElement.insertBefore(restoredItem, sibling);
  } else {
    dietOptionsListElement.appendChild(restoredItem);
  }

  requestAnimationFrame(() => {
    restoredItem.style.transition = "opacity 0.5s ease, transform 0.5s ease";
    restoredItem.style.opacity = "1";
    restoredItem.style.transform = "translateX(0)";
    initSwipeToDelete(restoredItem, diet.id, diet.date, diet.dietType);
  });

  updateDietListVisibility();
  dietOptionsListElement.classList.remove(CSS_CLASSES.HIDDEN);
  noDietsTextElement.classList.add(CSS_CLASSES.HIDDEN);
}
