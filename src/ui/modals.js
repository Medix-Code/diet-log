import {
  openDietModal,
  closeDietModal,
  displayDietOptions,
  removeDietItemFromList,
  restoreDietItemToList,
  setupDietModal,
} from "./modals/dietModal.js";
import {
  initSwipeToDeleteDotacio,
  initMouseSwipeToDeleteDotacio,
  updateDotacioListVisibility,
  restoreDotacioItemToList,
} from "./modals/dotacioModal.js";
import {
  showConfirmModal,
  setupConfirmModal,
} from "./modals/confirmModal.js";
import {
  registerModalTriggers,
  isAnyModalOpen,
  getActiveModalElement,
  closeActiveModal,
} from "./modals/modalManager.js";

export {
  showConfirmModal,
  openDietModal,
  closeDietModal,
  displayDietOptions,
  removeDietItemFromList,
  restoreDietItemToList,
  initSwipeToDeleteDotacio,
  initMouseSwipeToDeleteDotacio,
  updateDotacioListVisibility,
  restoreDotacioItemToList,
  isAnyModalOpen,
  getActiveModalElement,
  closeActiveModal,
};

export function setupModalGenerics() {
  setupConfirmModal();
  setupDietModal();
  registerModalTriggers();
}
