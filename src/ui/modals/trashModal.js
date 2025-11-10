// trashModal.js - Gestió del modal de paperera de dietes eliminades

import {
  getAllDeletedDiets,
  restoreDietFromTrash,
  deleteDietFromTrashPermanently,
  emptyTrash,
} from "../../db/indexedDbDietRepository.js";
import { getDietDisplayInfo } from "../../utils/utils.js";
import { showToast } from "../toast.js";
import { logger } from "../../utils/logger.js";
import { displayDietOptions } from "./dietModal.js";

const log = logger.withScope("Modals:Trash");

// ============================================================================
// GESTIÓ DEL MODAL
// ============================================================================

let currentFilters = {
  type: "all",
  date: null,
};

export function openTrashModal() {
  const modal = document.getElementById("trash-modal");
  if (!modal) return;

  modal.classList.add("visible");
  displayTrashItems();
}

export function closeTrashModal() {
  const modal = document.getElementById("trash-modal");
  if (!modal) return;

  modal.classList.remove("visible");
}

// ============================================================================
// RENDERITZACIÓ DE LA LLISTA
// ============================================================================

function createTrashItemElement(diet) {
  const template = document.getElementById("trash-item-template");
  if (!template) {
    log.warn("Template de paperera no trobat");
    return null;
  }

  const clone = template.content.cloneNode(true);
  const item = clone.querySelector(".trash-item");

  // Informació de la dieta
  const { displayText } = getDietDisplayInfo(diet.dietType);
  const typeSpan = clone.querySelector(".trash-item-type");
  const dateSpan = clone.querySelector(".trash-item-date");
  const deletedAtSpan = clone.querySelector(".trash-item-deleted-at");

  if (typeSpan) typeSpan.textContent = displayText;
  if (dateSpan) dateSpan.textContent = diet.date || "Sense data";
  if (deletedAtSpan) {
    const deletedDate = new Date(diet.deletedAt);
    const daysAgo = Math.floor(
      (Date.now() - deletedDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    deletedAtSpan.textContent =
      daysAgo === 0
        ? "Avui"
        : daysAgo === 1
          ? "Ahir"
          : `Fa ${daysAgo} dies`;
  }

  // Botons d'acció
  const restoreBtn = clone.querySelector(".trash-restore-btn");
  const deleteBtn = clone.querySelector(".trash-delete-btn");

  if (restoreBtn) {
    restoreBtn.addEventListener("click", async () => {
      await handleRestore(diet.id);
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      await handleDeletePermanently(diet.id, displayText);
    });
  }

  return item;
}

export async function displayTrashItems() {
  const trashList = document.getElementById("trash-options");
  const noTrashText = document.getElementById("no-trash-text");

  if (!trashList || !noTrashText) {
    log.error("Elements del modal de paperera no trobats");
    return;
  }

  // Netejar llista
  trashList.innerHTML = "";

  try {
    let deletedDiets = await getAllDeletedDiets();

    // Aplicar filtres
    deletedDiets = applyFilters(deletedDiets);

    // Ordenar per data d'eliminació (més recent primer)
    deletedDiets.sort(
      (a, b) => new Date(b.deletedAt) - new Date(a.deletedAt)
    );

    if (deletedDiets.length === 0) {
      trashList.classList.add("hidden");
      noTrashText.classList.remove("hidden");
      return;
    }

    trashList.classList.remove("hidden");
    noTrashText.classList.add("hidden");

    deletedDiets.forEach((diet) => {
      const item = createTrashItemElement(diet);
      if (item) trashList.appendChild(item);
    });
  } catch (error) {
    log.error("Error mostrant dietes eliminades:", error);
    showToast("Error carregant dietes eliminades", "error");
  }
}

function applyFilters(diets) {
  let filtered = [...diets];

  // Filtrar per tipus
  if (currentFilters.type !== "all") {
    filtered = filtered.filter(
      (d) => String(d.dietType) === String(currentFilters.type)
    );
  }

  // Filtrar per data
  if (currentFilters.date) {
    filtered = filtered.filter((d) => d.date === currentFilters.date);
  }

  return filtered;
}

// ============================================================================
// GESTIÓ D'ACCIONS
// ============================================================================

async function handleRestore(id) {
  try {
    const restoredDiet = await restoreDietFromTrash(id);

    showToast("Dieta restaurada correctament", "success", 3000);

    // Actualitzar modal de paperera
    displayTrashItems();

    // Actualitzar llista de dietes actives
    displayDietOptions();
  } catch (error) {
    log.error("Error restaurant dieta:", error);
    showToast("Error restaurant la dieta", "error");
  }
}

async function handleDeletePermanently(id, dietName) {
  const confirmed = confirm(
    `Vols eliminar permanentment "${dietName}"?\n\nAquesta acció no es pot desfer.`
  );

  if (!confirmed) return;

  try {
    await deleteDietFromTrashPermanently(id);

    showToast("Dieta eliminada permanentment", "success", 3000);

    // Actualitzar llista
    displayTrashItems();
  } catch (error) {
    log.error("Error eliminant dieta permanentment:", error);
    showToast("Error eliminant la dieta", "error");
  }
}

async function handleEmptyTrash() {
  const deletedDiets = await getAllDeletedDiets();

  if (deletedDiets.length === 0) {
    showToast("La paperera ja està buida", "info");
    return;
  }

  const confirmed = confirm(
    `Vols buidar la paperera?\n\nS'eliminaran ${deletedDiets.length} dietes permanentment.\n\nAquesta acció no es pot desfer.`
  );

  if (!confirmed) return;

  try {
    await emptyTrash();

    showToast("Paperera buidada correctament", "success", 3000);

    // Actualitzar llista
    displayTrashItems();
  } catch (error) {
    log.error("Error buidant paperera:", error);
    showToast("Error buidant la paperera", "error");
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

export function initTrashModal() {
  // Botó obrir paperera des del modal de dietes
  const openBtn = document.getElementById("open-trash-btn");
  if (openBtn) {
    openBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openTrashModal();
    });
  }

  // Botó tancar modal
  const closeBtn = document.getElementById("close-trash-modal");
  if (closeBtn) {
    closeBtn.addEventListener("click", closeTrashModal);
  }

  // Tancar en clicar fora del modal
  const modal = document.getElementById("trash-modal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeTrashModal();
      }
    });
  }

  // Botó buidar paperera
  const emptyBtn = document.getElementById("empty-trash-btn");
  if (emptyBtn) {
    emptyBtn.addEventListener("click", handleEmptyTrash);
  }

  // Filtres
  const typeFilter = document.getElementById("trash-filter-type");
  if (typeFilter) {
    typeFilter.addEventListener("change", (e) => {
      currentFilters.type = e.target.value;
      displayTrashItems();
    });
  }

  const dateFilter = document.getElementById("trash-filter-date");
  if (dateFilter) {
    dateFilter.addEventListener("change", (e) => {
      currentFilters.date = e.target.value || null;
      displayTrashItems();
    });
  }

  const clearFiltersBtn = document.getElementById("trash-clear-filters");
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      currentFilters = { type: "all", date: null };
      if (typeFilter) typeFilter.value = "all";
      if (dateFilter) dateFilter.value = "";
      displayTrashItems();
    });
  }

  log.debug("Modal de paperera inicialitzat");
}
