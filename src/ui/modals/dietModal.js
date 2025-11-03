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
  deleteReveal.innerHTML = `
    <div class="delete-reveal-content">
      <img src="assets/icons/delete.svg" alt="Eliminar" class="icon">
      <span class="delete-text">Eliminar dieta</span>
    </div>
  `;

  const loadBtn = document.createElement("button");
  loadBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} ${CSS_CLASSES.LIST_ITEM_BTN_LOAD} ${CSS_CLASSES.DIET_LOAD_BTN}`;
  loadBtn.setAttribute("aria-label", `Editar dieta ${ddmmaa}`);
  loadBtn.innerHTML = `<img src="assets/icons/ic_edit.svg" alt="" class="icon"><span class="btn-text visually-hidden">Editar</span>`;
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_ID, displayId);
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_DATE, diet.date);
  loadBtn.setAttribute(DATA_ATTRIBUTES.DIET_TYPE, diet.dietType);

  const downloadBtn = document.createElement("button");
  downloadBtn.className = `${CSS_CLASSES.LIST_ITEM_BTN} diet-download`;
  downloadBtn.setAttribute(
    "aria-label",
    `Descarregar PDF de la dieta ${ddmmaa}`
  );
  downloadBtn.innerHTML = `<img src="assets/icons/download_blue.svg" alt="" class="icon"><span class="btn-text visually-hidden">PDF</span>`;
  downloadBtn.setAttribute(DATA_ATTRIBUTES.DIET_ID, displayId);

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

  dietItem.addEventListener("mousedown", (event) => {
    if (event.target.closest("button") || event.target.closest(".diet-icons"))
      return;
    startX = event.clientX;
    currentX = startX;
    isDragging = false;
  });

  document.addEventListener("mousemove", (event) => {
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
  });

  document.addEventListener("mouseup", async () => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - currentX;

    dietItem.classList.remove(CSS_CLASSES.DIET_ITEM_SWIPING);
    dietItem.style.transition = "transform 0.3s ease, opacity 0.3s ease";

    if (diff > 50) {
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

    setTimeout(() => {
      dietItem.style.transition = "";
      dietItem.style.opacity = "";
    }, 300);
  });
}

function initSwipeToDelete(dietItem, dietId, dietDate, dietType) {
  let startX = 0;
  let currentX = 0;
  let isSwiping = false;

  dietItem.addEventListener(
    "touchstart",
    (event) => {
      if (event.target.closest("button") || event.target.closest(".diet-icons"))
        return;
      startX = event.touches[0].clientX;
      currentX = startX;
      isSwiping = false;
      event.stopPropagation();
    },
    { passive: false }
  );

  dietItem.addEventListener(
    "touchmove",
    (event) => {
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
    },
    { passive: false }
  );

  dietItem.addEventListener("touchend", async (event) => {
    if (!isSwiping) return;
    isSwiping = false;
    const diff = startX - currentX;

    dietItem.classList.remove(CSS_CLASSES.DIET_ITEM_SWIPING);
    dietItem.style.transition = "transform 0.3s ease, opacity 0.3s ease";

    if (diff > 50) {
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

    setTimeout(() => {
      dietItem.style.transition = "";
      dietItem.style.opacity = "";
    }, 300);

    event.stopPropagation();
  });

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
      .sort((a, b) => new Date(b.timeStampDiet) - new Date(a.timeStampDiet))
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
