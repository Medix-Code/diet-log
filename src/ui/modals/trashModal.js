// trashModal.js - Gestió del modal de paperera de dietes eliminades

import {
  getAllDeletedDiets,
  restoreDietFromTrash,
  deleteDietFromTrashPermanently,
  emptyTrash,
} from "../../db/indexedDbDietRepository.js";
import {
  getDietDisplayInfo,
  capitalizeFirstLetter,
} from "../../utils/utils.js";
import { showToast } from "../toast.js";
import { logger } from "../../utils/logger.js";
import { displayDietOptions, openDietModal } from "./dietModal.js";
import { openModal, closeModal } from "./modalManager.js";

const log = logger.withScope("Modals:Trash");

// ============================================================================
// GESTIÓ DEL MODAL
// ============================================================================

let currentFilters = {
  type: "all",
  date: null,
};
let trashRenderToken = 0;

export function openTrashModal() {
  const modal = document.getElementById("trash-modal");
  if (!modal) return;

  openModal(modal);
  displayTrashItems();
}

export function closeTrashModal() {
  const modal = document.getElementById("trash-modal");
  if (!modal) return;

  closeModal(modal);
  // Sempre tornar al modal de dietes després de tancar la paperera
  openDietModal();
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
  const { ddmmaa, franjaText } = getDietDisplayInfo(diet.date, diet.dietType);
  const dateSpan = clone.querySelector(".trash-item-date");
  const typeBadge = clone.querySelector(".trash-item-type-badge");
  if (dateSpan) dateSpan.textContent = ddmmaa;
  if (typeBadge) typeBadge.textContent = capitalizeFirstLetter(franjaText);

  // Botons d'acció
  const restoreBtn = clone.querySelector(".trash-restore-btn");
  const deleteBtn = clone.querySelector(".trash-delete-btn");

  if (restoreBtn) {
    restoreBtn.addEventListener("click", async () => {
      await handleRestore(diet.id);
    });
  }

  const cardLabel = ddmmaa;
  if (deleteBtn) {
    deleteBtn.addEventListener("click", async () => {
      await handleDeletePermanently(diet.id, cardLabel);
    });
  }

  return item;
}

export async function displayTrashItems() {
  const trashList = document.getElementById("trash-options");
  const noTrashText = document.getElementById("no-trash-text");
  const currentToken = ++trashRenderToken;

  if (!trashList || !noTrashText) {
    log.error("Elements del modal de paperera no trobats");
    return;
  }

  try {
    let deletedDiets = await getAllDeletedDiets();
    if (currentToken !== trashRenderToken) return;

    // Aplicar filtres
    deletedDiets = applyFilters(deletedDiets);

    // Ordenar per data d'eliminació (més recent primer)
    deletedDiets.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

    // Evitar duplicates per ID (ABANS de renderitzar)
    const seenFingerprints = new Set();
    deletedDiets = deletedDiets.filter((diet) => {
      // Usar només l'ID com a fingerprint únic
      if (!diet.id) {
        log.warn("Dieta sense ID trobada a la paperera:", diet);
        return false; // Excloure dietes sense ID
      }
      if (seenFingerprints.has(diet.id)) {
        log.warn("Dieta duplicada detectada i exclosa:", diet.id);
        return false;
      }
      seenFingerprints.add(diet.id);
      return true;
    });

    // Netejar llista DESPRÉS de processar les dades
    trashList.innerHTML = "";

    if (deletedDiets.length === 0) {
      trashList.classList.add("hidden");
      noTrashText.classList.remove("hidden");
      return;
    }

    trashList.classList.remove("hidden");
    noTrashText.classList.add("hidden");

    // Crear un fragment per afegir tots els items d'un cop (millor rendiment)
    const fragment = document.createDocumentFragment();
    deletedDiets.forEach((diet) => {
      if (currentToken !== trashRenderToken) return;
      const item = createTrashItemElement(diet);
      if (item) fragment.appendChild(item);
    });

    trashList.appendChild(fragment);
  } catch (error) {
    log.error("Error mostrant dietes eliminades:", error);
    showToast("Error cargando dietas eliminadas", "error");
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

    showToast("Dieta restaurada correctamente", "success", 3000);

    // Actualitzar modal de paperera
    displayTrashItems();

    // Actualitzar llista de dietes actives
    displayDietOptions();
  } catch (error) {
    log.error("Error restaurant dieta:", error);
    showToast("Error restaurando la dieta", "error");
  }
}

async function handleDeletePermanently(id, dietName) {
  const confirmed = confirm(
    `Vols eliminar permanentment "${dietName}"?\n\nAquesta acció no es pot desfer.`
  );

  if (!confirmed) return;

  try {
    await deleteDietFromTrashPermanently(id);

    showToast("Dieta eliminada permanentemente", "success", 3000);

    // Actualitzar llista
    displayTrashItems();
  } catch (error) {
    log.error("Error eliminant dieta permanentment:", error);
    showToast("Error eliminando la dieta", "error");
  }
}

async function handleEmptyTrash() {
  const deletedDiets = await getAllDeletedDiets();

  if (deletedDiets.length === 0) {
    showToast("La papelera ya está vacía", "info");
    return;
  }

  const confirmed = confirm(
    `Vols buidar la paperera?\n\nS'eliminaran ${deletedDiets.length} dietes permanentment.\n\nAquesta acció no es pot desfer.`
  );

  if (!confirmed) return;

  try {
    await emptyTrash();

    showToast("Papelera vaciada correctamente", "success", 3000);

    // Actualitzar llista
    displayTrashItems();
  } catch (error) {
    log.error("Error buidant paperera:", error);
    showToast("Error vaciando la papelera", "error");
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

export function initTrashModal() {
  log.debug("Inicialitzant modal de paperera...");

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
