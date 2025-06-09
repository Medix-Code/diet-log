/**
 * @file servicesPanelManager.js
 * @description Gestor dels panells de servei (S1-S4) i de la barra de “chips”
 *              (3.6 / 3.22 / 3.11) — cada servei pot tenir el seu mode propi.
 * @module servicesPanelManager
 */

/* ────────────────────────────────────────────────────────────────────────── */
/* CONSTANTS                                                                */
/* ────────────────────────────────────────────────────────────────────────── */
const DOM_IDS = {
  CONTAINER: "services-container",
  BUTTONS_CONTAINER: "service-buttons-container",
  OPTIONS_MENU: "options-menu",
  OPTIONS_TOGGLE_BTN: "options-toggle",
  CLEAR_BTN: "clear-selected-service",
  CAMERA_BTN: "camera-in-dropdown",
  CHIP_GROUP: "service-mode-chips", // barra de chips global
};

const SELECTORS = {
  SERVICE_PANEL: ".service",
  SERVICE_BUTTON: ".service-button",
  CHIP: ".chip",
  FORM_GROUP: ".form-group", // Helper selector for form groups
};

const CSS_CLASSES = {
  SERVICE_HIDDEN: "hidden",
  BUTTON_ACTIVE: "active-square",
  SERVICE_COLORS: ["service-1", "service-2", "service-3", "service-4"],
  OPTIONS_MENU_HIDDEN: "hidden",
  CHIP_ACTIVE: "chip-active",
};

// Selectors for inputs within form-groups that s’oculten en modes “bàsics” (3.22 / 3.11)
const DESTINATION_FIELD_SELECTORS = [
  ".destination", // input destí
  ".destination-time", // hora destí
];

/* ────────────────────────────────────────────────────────────────────────── */
/* STATE                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */
let isInitialized = false;
let currentServiceIndex = 0; // 0..3  (S1 és 0)
let servicePanels = [];
let serviceButtons = [];

let servicesContainerEl = null;
let serviceButtonsContEl = null;
let optionsMenuEl = null;
let optionsToggleBtnEl = null;
let globalChipBarEl = null; // Element for the global chip bar
let globalChipButtons = []; // Buttons in the global chip bar

/** Array amb el mode de cada servei – valors: "3.6", "3.22", "3.11"          */
export let serviceModes = []; // es crea a init()

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS – NAVEGACIÓ S1-S4                                                 */
/* ────────────────────────────────────────────────────────────────────────── */
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

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS – MENÚ D'OPCIONS (tres punts)                                     */
/* ────────────────────────────────────────────────────────────────────────── */
function _attachOptionsMenuListeners() {
  if (!optionsMenuEl || !optionsToggleBtnEl) return;

  optionsToggleBtnEl.addEventListener("click", (e) => {
    e.stopPropagation();
    optionsMenuEl.classList.toggle(CSS_CLASSES.OPTIONS_MENU_HIDDEN);
  });

  document.addEventListener("click", (e) => {
    if (
      optionsToggleBtnEl && // Check if optionsToggleBtnEl exists
      !optionsToggleBtnEl.contains(e.target) &&
      optionsMenuEl && // Check if optionsMenuEl exists
      !optionsMenuEl.contains(e.target)
    ) {
      optionsMenuEl.classList.add(CSS_CLASSES.OPTIONS_MENU_HIDDEN);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && optionsMenuEl) {
      optionsMenuEl.classList.add(CSS_CLASSES.OPTIONS_MENU_HIDDEN);
    }
  });

  if (optionsMenuEl) {
    optionsMenuEl.addEventListener("click", (e) => {
      if (e.target.closest("button")) {
        optionsMenuEl.classList.add(CSS_CLASSES.OPTIONS_MENU_HIDDEN);
      }
    });
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS – CHIPS                                                           */
/* ────────────────────────────────────────────────────────────────────────── */
/** Troba el .form-group pare d’un input dins del panell */
const _findFormGroup = (panel, inputSelector) => {
  const input = panel.querySelector(inputSelector);
  return input ? input.closest(SELECTORS.FORM_GROUP) : null;
};

/** Amaga/mostra els camps de destí segons el mode */
// A servicesPanelManager.js

/** Amaga/mostra els camps de destí i ajusta el 'enterkeyhint' segons el mode. */
function _applyModeToPanelUI(panel, mode) {
  if (!panel) return;

  const isBasicMode = mode !== "3.6"; // true si és 3.22 o 3.11

  // 1. Amaga/mostra els camps de destí
  DESTINATION_FIELD_SELECTORS.forEach((sel) => {
    _findFormGroup(panel, sel)?.classList.toggle(
      CSS_CLASSES.SERVICE_HIDDEN,
      isBasicMode
    );
  });

  // 2. >>> NOVA LÒGICA: Canvia l'acció del teclat virtual <<<
  const originInput = panel.querySelector(".origin");
  if (originInput) {
    if (isBasicMode) {
      // En modes bàsics, "Origen" és l'últim camp de text, així que mostrem "Done"
      originInput.setAttribute("enterkeyhint", "done");
      console.log(
        `[UI Mode] 'enterkeyhint' establert a "done" per a l'origen.`
      );
    } else {
      // En mode complet (3.6), eliminem l'atribut perquè el teclat mostri "Next"
      originInput.removeAttribute("enterkeyhint");
      console.log(`[UI Mode] 'enterkeyhint' eliminat de l'origen.`);
    }
  }
}

/** Marca el chip actiu visualment a la barra de chips global */
function _updateGlobalChipBarUI(mode) {
  // console.log(`[Services] Global chip bar UI updated to mode: ${mode}`);
  if (!globalChipBarEl) return; // No global chip bar found or configured
  globalChipButtons.forEach((btn) =>
    btn.classList.toggle(CSS_CLASSES.CHIP_ACTIVE, btn.dataset.mode === mode)
  );
}

/** Actualitza visualment els chips dins d'un panell específic */
function _updatePanelChipsUI(panel, activeMode) {
  const chipsInPanel = panel.querySelectorAll(SELECTORS.CHIP);
  chipsInPanel.forEach((chip) => {
    chip.classList.toggle(
      CSS_CLASSES.CHIP_ACTIVE,
      chip.dataset.mode === activeMode
    );
  });
}

/** Listeners pels chips dins de cada panell de servei */
/** Listeners pels chips dins de cada panell de servei */
function _attachPanelChipListeners() {
  servicePanels.forEach((panel, idx) => {
    // 'panel' aquí és el panell de servei actual (S1, S2, etc.)
    const chipGroup = panel.querySelector(".chip-group"); // Troba el .chip-group DINS del panell actual
    const chipsInPanel = panel.querySelectorAll(SELECTORS.CHIP); // Troba tots els .chip DINS del panell actual

    chipsInPanel.forEach((chipButton) => {
      // 'chipButton' és cada un dels botons .chip (3.6, 3.22, 3.11)
      chipButton.addEventListener("click", () => {
        const mode = chipButton.dataset.mode;
        if (serviceModes[idx] === mode) return;

        serviceModes[idx] = mode;

        // Actualitzem la UI DINS d’aquest 'panel' (el del forEach exterior)
        _updatePanelChipsUI(panel, mode);
        _applyModeToPanelUI(panel, mode);

        // Aplica la classe de color al 'chipGroup' que hem trobat abans
        if (chipGroup) {
          CSS_CLASSES.SERVICE_COLORS.forEach((colorClass) =>
            chipGroup.classList.remove(colorClass)
          );
          // Afegeix la classe de color que correspon a l'índex (idx) del panell actual
          chipGroup.classList.add(CSS_CLASSES.SERVICE_COLORS[idx]);
        }

        // Com que has eliminat la part de la barra global, no cal la comprovació de currentServiceIndex aquí per a això.
        // Però si la necessitessis per a una altra cosa, 'idx' i 'currentServiceIndex' són correctes.
      });
    });
  });
}
/* ────────────────────────────────────────────────────────────────────────── */
/* HELPERS – BOTONS EXTERNS (clear / camera / options)                       */
/* ────────────────────────────────────────────────────────────────────────── */
function _updateExternalButtonStyles(idx) {
  const colorClass = CSS_CLASSES.SERVICE_COLORS[idx];
  const styleBtn = (el, baseClass) => {
    if (!el) return;
    el.classList.remove(...CSS_CLASSES.SERVICE_COLORS); // Remove all service color classes
    el.classList.add(baseClass, colorClass); // Add base and current service color
  };
  styleBtn(document.getElementById(DOM_IDS.CLEAR_BTN), "clear-selected-btn");
  styleBtn(document.getElementById(DOM_IDS.CAMERA_BTN), "camera-btn");
  styleBtn(optionsToggleBtnEl, "options-btn");
}

/* ────────────────────────────────────────────────────────────────────────── */
/* INIT                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */
export function initServices() {
  if (isInitialized) return;

  servicesContainerEl = document.getElementById(DOM_IDS.CONTAINER);
  serviceButtonsContEl = document.getElementById(DOM_IDS.BUTTONS_CONTAINER);
  optionsMenuEl = document.getElementById(DOM_IDS.OPTIONS_MENU);
  optionsToggleBtnEl = document.getElementById(DOM_IDS.OPTIONS_TOGGLE_BTN);
  //globalChipBarEl = document.getElementById(DOM_IDS.CHIP_GROUP);

  if (!servicesContainerEl || !serviceButtonsContEl) {
    console.error(
      "[Services] Falten contenidors essencials (services-container o service-buttons-container)."
    );
    return;
  }

  servicePanels = Array.from(
    servicesContainerEl.querySelectorAll(SELECTORS.SERVICE_PANEL)
  );
  if (!servicePanels.length) {
    console.warn("[Services] No s’han trobat panells .service");
    return;
  }

  // Mode per defecte de cada servei: 3.6
  serviceModes = servicePanels.map(() => "3.6");

  _createServiceButtons();
  _attachOptionsMenuListeners();
  _attachPanelChipListeners(); // Changed from _attachChipListeners

  // Estat inicial (només S1 visible)
  if (servicePanels.length > 0 && serviceButtons.length > 0) {
    servicePanels.forEach((p, i) =>
      p.classList.toggle(CSS_CLASSES.SERVICE_HIDDEN, i !== 0)
    );
    serviceButtons[0].classList.add(CSS_CLASSES.BUTTON_ACTIVE);

    // Apply UI for the initial service (S1)
    const initialMode = serviceModes[0];
    _applyModeToPanelUI(servicePanels[0], initialMode);
    _updatePanelChipsUI(servicePanels[0], initialMode); // Ensure panel chips are correct
    // Afegeix la classe de color al chip-group inicial
    const initialChipGroup = servicePanels[0].querySelector(".chip-group");
    if (initialChipGroup) {
      initialChipGroup.classList.add(CSS_CLASSES.SERVICE_COLORS[0]);
    }
    _updateGlobalChipBarUI(initialMode); // Ensure global bar is correct
    _updateExternalButtonStyles(0);
  }

  isInitialized = true;
  console.log("[Services] Iniciat OK");
}

/* ────────────────────────────────────────────────────────────────────────── */
/* CANVI DE SERVEI (S1-S4)                                                   */
/* ────────────────────────────────────────────────────────────────────────── */
export function showService(idx) {
  if (idx < 0 || idx >= servicePanels.length || idx === currentServiceIndex)
    return;

  // Amaga / mostra panells
  servicePanels[currentServiceIndex].classList.add(CSS_CLASSES.SERVICE_HIDDEN);
  servicePanels[idx].classList.remove(CSS_CLASSES.SERVICE_HIDDEN);

  // Botons S1-S4
  serviceButtons[currentServiceIndex].classList.remove(
    CSS_CLASSES.BUTTON_ACTIVE
  );
  serviceButtons[idx].classList.add(CSS_CLASSES.BUTTON_ACTIVE);

  currentServiceIndex = idx;

  // Sincronitza chips i camps del panell nou
  const modeForNewService = serviceModes[idx];
  _applyModeToPanelUI(servicePanels[idx], modeForNewService);

  _updatePanelChipsUI(servicePanels[idx], modeForNewService);

  // Actualitza la classe de color al chip-group del nou panell visible
  const currentPanelChipGroup = servicePanels[idx].querySelector(".chip-group");
  if (currentPanelChipGroup) {
    CSS_CLASSES.SERVICE_COLORS.forEach((colorClass) =>
      currentPanelChipGroup.classList.remove(colorClass)
    ); // Neteja per si de cas
    currentPanelChipGroup.classList.add(CSS_CLASSES.SERVICE_COLORS[idx]);
  }
  _updateExternalButtonStyles(idx);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* API UTILITATS                                                             */
/* ────────────────────────────────────────────────────────────────────────── */
export const getCurrentServiceIndex = () => currentServiceIndex;

/**
 * Retorna el mode del servei per a l'índex donat.
 * @param {number} index - L'índex del servei (0, 1, 2, 3).
 * @returns {string | undefined} El mode ("3.6", "3.22", "3.11") o undefined si l'índex és invàlid.
 */
export const getModeForService = (index) => {
  if (index >= 0 && index < serviceModes.length) {
    return serviceModes[index];
  }
  return undefined; // És millor retornar undefined que un valor per defecte, perquè qui crida sàpiga que no s'ha trobat.
};

/** Neteja tots els inputs d’un panell */
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
    // For select elements, you might want to reset to the first option
    if (el.tagName === "SELECT") {
      el.selectedIndex = 0; // Or -1 if you want no option selected by default if allowed
    }
  });
}

/** Re-aplica colors dels botons externs (cridat des d’altres mòduls) */
export function updateExternalStylesForCurrentService() {
  _updateExternalButtonStyles(currentServiceIndex);
}

/*  ═══════════════  PUBLIC: força un mode a un servei  ═══════════════  */

/**
 * Posa el mode (chip) corresponent al servei [index] i actualitza l’UI del panell.
 * També actualitza la barra de chips global si el servei afectat és el que s'està mostrant.
 * @param {number} index - Índex del servei (0, 1, 2, 3)
 * @param {string} mode - "3.6", "3.22" o "3.11"
 */
export function setModeForService(index, mode) {
  if (index < 0 || index >= servicePanels.length) {
    console.warn(
      `[Services] Intent d'establir mode per a un servei invàlid (índex: ${index})`
    );
    return;
  }
  // No actualitzar si el mode ja és el mateix, per evitar feina innecessària.
  // if (serviceModes[index] === mode) return;

  console.log(`[Services] Forçant mode '${mode}' per al servei ${index + 1}`);
  serviceModes[index] = mode;

  const panel = servicePanels[index];
  if (!panel) {
    console.error(
      `[Services] No s'ha trobat el panell per al servei amb índex ${index}`
    );
    return;
  }

  // Actualitza els chips dins del panell del servei
  _updatePanelChipsUI(panel, mode);

  // Mostra/amaga camps dins del panell segons el nou mode
  _applyModeToPanelUI(panel, mode);

  // Si el servei modificat és el que s'està mostrant actualment,
  // actualitza també la barra de chips global.
  //if (index === currentServiceIndex) {
  // _updateGlobalChipBarUI(mode);
  // }
}
