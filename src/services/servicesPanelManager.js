/**
 * @file servicesPanelManager.js
 * @description Gestor de panells de servei i chips.
 * @module servicesPanelManager
 */

import { revalidateFormState } from "./formService.js";

// --- Constants ---

const ALLOWED_MODES = ["3.6", "3.22", "3.11"];

const DOM_IDS = {
  CONTAINER: "services-container",
  BUTTONS_CONTAINER: "service-buttons-container",
  OPTIONS_MENU: "options-menu",
  OPTIONS_TOGGLE_BTN: "options-toggle",
  CLEAR_BTN: "clear-selected-service",
  CAMERA_BTN: "camera-in-dropdown",
  CHIP_GROUP: "service-mode-chips",
};

const SELECTORS = {
  SERVICE_PANEL: ".service",
  SERVICE_BUTTON: ".service-button",
  CHIP: ".chip",
  FORM_GROUP: ".form-group",
};

const CSS_CLASSES = {
  SERVICE_HIDDEN: "hidden",
  BUTTON_ACTIVE: "active-square",
  SERVICE_COLORS: ["service-1", "service-2", "service-3", "service-4"],
  OPTIONS_MENU_HIDDEN: "hidden",
  CHIP_ACTIVE: "chip-active",
};

const TSNU_HIDDEN_ELEMENT_SELECTORS = [
  ".chip-group-title",
  ".chip-group",
  ".btn-ocr-inline",
  ".section-divider",
];

const DESTINATION_FIELD_SELECTORS = [".destination", ".destination-time"];

// --- Estat ---
let isInitialized = false;
let currentServiceIndex = 0;
let servicePanels = [];
let serviceButtons = [];
let allServicePanels = [];

let servicesContainerEl = null;
let serviceButtonsContEl = null;
let optionsMenuEl = null;
let optionsToggleBtnEl = null;
let globalChipBarEl = null;
let globalChipButtons = [];

export let serviceModes = [];
export let serviceNotes = ["", "", "", ""];

// --- Helpers ---

function _createServiceButtons() {
  if (!serviceButtonsContEl) return;
  serviceButtonsContEl.innerHTML = "";
  serviceButtons = servicePanels.map((_, idx) => {
    const btn = document.createElement("button");
    btn.className = `service-button ${CSS_CLASSES.SERVICE_COLORS[idx]}`;
    btn.textContent = `S${idx + 1}`;
    btn.type = "button";
    btn.setAttribute("aria-label", `Mostrar servei ${idx + 1}`);
    btn.addEventListener("click", () => showService(idx));
    serviceButtonsContEl.appendChild(btn);
    return btn;
  });
}

function _attachOptionsMenuListeners() {
  if (!optionsMenuEl || !optionsToggleBtnEl) return;

  optionsToggleBtnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    optionsMenuEl.classList.toggle(CSS_CLASSES.OPTIONS_MENU_HIDDEN);
  });

  document.addEventListener("click", (e) => {
    if (
      !optionsToggleBtnEl?.contains(e.target) &&
      !optionsMenuEl?.contains(e.target)
    ) {
      optionsMenuEl.classList.add(CSS_CLASSES.OPTIONS_MENU_HIDDEN);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && optionsMenuEl)
      optionsMenuEl.classList.add(CSS_CLASSES.OPTIONS_MENU_HIDDEN);
  });

  optionsMenuEl.addEventListener("click", (e) => {
    if (e.target.closest("button"))
      optionsMenuEl.classList.add(CSS_CLASSES.OPTIONS_MENU_HIDDEN);
  });
}

function _findFormGroup(panel, inputSelector) {
  const input = panel.querySelector(inputSelector);
  return input ? input.closest(SELECTORS.FORM_GROUP) : null;
}

function _applyModeToPanelUI(panel, mode) {
  if (!panel) return;

  const isBasicMode = mode !== "3.6";

  DESTINATION_FIELD_SELECTORS.forEach((sel) => {
    _findFormGroup(panel, sel)?.classList.toggle(
      CSS_CLASSES.SERVICE_HIDDEN,
      isBasicMode
    );
  });

  const originInput = panel.querySelector(".origin");
  if (originInput) {
    if (isBasicMode) originInput.setAttribute("enterkeyhint", "done");
    else originInput.removeAttribute("enterkeyhint");
  }
}

function _updateGlobalChipBarUI(mode) {
  if (!globalChipBarEl) return;
  globalChipButtons.forEach((btn) =>
    btn.classList.toggle(CSS_CLASSES.CHIP_ACTIVE, btn.dataset.mode === mode)
  );
}

function _updatePanelChipsUI(panel, activeMode) {
  const chipsInPanel = panel.querySelectorAll(SELECTORS.CHIP);
  chipsInPanel.forEach((chip) =>
    chip.classList.toggle(
      CSS_CLASSES.CHIP_ACTIVE,
      chip.dataset.mode === activeMode
    )
  );
}

// Busca aquesta funció al teu codi...
function _attachPanelChipListeners() {
  servicePanels.forEach((panel, idx) => {
    const chipsInPanel = panel.querySelectorAll(SELECTORS.CHIP);

    chipsInPanel.forEach((chipButton) => {
      chipButton.addEventListener("click", () => {
        const mode = chipButton.dataset.mode;

        if (!ALLOWED_MODES.includes(mode)) {
          console.error(
            `Intent de canviar a un mode invàlid: "${mode}". Acció bloquejada.`
          );
          return;
        }
        if (serviceModes[idx] === mode) return;

        serviceModes[idx] = mode;

        _updatePanelChipsUI(panel, mode);
        _applyModeToPanelUI(panel, mode);

        const chipGroup = panel.querySelector(".chip-group");
        if (chipGroup) {
          CSS_CLASSES.SERVICE_COLORS.forEach((colorClass) =>
            chipGroup.classList.remove(colorClass)
          );
          chipGroup.classList.add(CSS_CLASSES.SERVICE_COLORS[idx]);
        }

        revalidateFormState();
      });
    });
  });
}
// Dins de servicesPanelManager.js
function _updateExternalButtonStyles(idx) {
  const colorClass = CSS_CLASSES.SERVICE_COLORS[idx];
  const styleBtn = (el, baseClass) => {
    if (!el) return;
    el.classList.remove(...CSS_CLASSES.SERVICE_COLORS);
    el.classList.add(baseClass, colorClass);
  };
  styleBtn(document.getElementById(DOM_IDS.CLEAR_BTN), "clear-selected-btn");
  styleBtn(document.getElementById(DOM_IDS.CAMERA_BTN), "camera-btn");
  // AFEGEIX AQUESTA LÍNIA:
  styleBtn(document.getElementById("notes-selected-service"), "notes-btn");
  styleBtn(optionsToggleBtnEl, "options-btn");
}

// --- Init ---

export function initServices() {
  if (isInitialized) return;

  allServicePanels = document.querySelectorAll(SELECTORS.SERVICE_PANEL);
  servicesContainerEl = document.getElementById(DOM_IDS.CONTAINER);
  serviceButtonsContEl = document.getElementById(DOM_IDS.BUTTONS_CONTAINER);
  optionsMenuEl = document.getElementById(DOM_IDS.OPTIONS_MENU);
  optionsToggleBtnEl = document.getElementById(DOM_IDS.OPTIONS_TOGGLE_BTN);

  if (!servicesContainerEl || !serviceButtonsContEl) return;

  servicePanels = Array.from(
    servicesContainerEl.querySelectorAll(SELECTORS.SERVICE_PANEL)
  );
  if (!servicePanels.length) return;

  serviceModes = servicePanels.map(() => "3.6");

  _createServiceButtons();
  _attachOptionsMenuListeners();
  _attachPanelChipListeners();

  if (servicePanels.length > 0 && serviceButtons.length > 0) {
    servicePanels.forEach((p, i) =>
      p.classList.toggle(CSS_CLASSES.SERVICE_HIDDEN, i !== 0)
    );
    serviceButtons[0].classList.add(CSS_CLASSES.BUTTON_ACTIVE);

    const initialMode = serviceModes[0];
    _applyModeToPanelUI(servicePanels[0], initialMode);
    _updatePanelChipsUI(servicePanels[0], initialMode);

    const initialChipGroup = servicePanels[0].querySelector(".chip-group");
    if (initialChipGroup)
      initialChipGroup.classList.add(CSS_CLASSES.SERVICE_COLORS[0]);

    _updateGlobalChipBarUI(initialMode);
    _updateExternalButtonStyles(0);
  }

  isInitialized = true;
}

// --- Altres funcions públiques ---

export function showService(idx) {
  if (idx < 0 || idx >= servicePanels.length || idx === currentServiceIndex)
    return;

  servicePanels[currentServiceIndex].classList.add(CSS_CLASSES.SERVICE_HIDDEN);
  servicePanels[idx].classList.remove(CSS_CLASSES.SERVICE_HIDDEN);

  serviceButtons[currentServiceIndex].classList.remove(
    CSS_CLASSES.BUTTON_ACTIVE
  );
  serviceButtons[idx].classList.add(CSS_CLASSES.BUTTON_ACTIVE);

  currentServiceIndex = idx;

  const modeForNewService = serviceModes[idx];
  _applyModeToPanelUI(servicePanels[idx], modeForNewService);
  _updatePanelChipsUI(servicePanels[idx], modeForNewService);

  const currentPanelChipGroup = servicePanels[idx].querySelector(".chip-group");
  if (currentPanelChipGroup) {
    CSS_CLASSES.SERVICE_COLORS.forEach((colorClass) =>
      currentPanelChipGroup.classList.remove(colorClass)
    );
    currentPanelChipGroup.classList.add(CSS_CLASSES.SERVICE_COLORS[idx]);
  }
  _updateExternalButtonStyles(idx);
}

export const getCurrentServiceIndex = () => currentServiceIndex;

export const getModeForService = (index) => {
  if (index >= 0 && index < serviceModes.length) return serviceModes[index];
  return undefined;
};

export function clearServiceFields(panel) {
  if (!panel) return;
  panel.querySelectorAll("input, select, textarea").forEach((el) => {
    if (el.type === "checkbox" || el.type === "radio") {
      el.checked = false;
    } else if (
      el.type !== "button" &&
      el.type !== "submit" &&
      el.type !== "reset"
    ) {
      el.value = "";
    }
    if (el.tagName === "SELECT") el.selectedIndex = 0;
  });
}

export function updateExternalStylesForCurrentService() {
  _updateExternalButtonStyles(currentServiceIndex);
}

export function setModeForService(index, mode) {
  if (index < 0 || index >= servicePanels.length) return;

  serviceModes[index] = mode;

  const panel = servicePanels[index];
  if (!panel) return;

  _updatePanelChipsUI(panel, mode);
  _applyModeToPanelUI(panel, mode);

  revalidateFormState();
}

export function updateServicePanelsForServiceType(serviceType) {
  const isTSNU = serviceType === "TSNU";

  // Ara 'allServicePanels' és accessible aquí
  allServicePanels.forEach((panel) => {
    TSNU_HIDDEN_ELEMENT_SELECTORS.forEach((selector) => {
      const element = panel.querySelector(selector);
      element?.classList.toggle(CSS_CLASSES.SERVICE_HIDDEN, isTSNU);
    });
  });
}

export function removeErrorClassesFromService(panel) {
  if (!panel) return;
  panel
    .querySelectorAll(".input-error")
    .forEach((el) => el.classList.remove("input-error"));
}
