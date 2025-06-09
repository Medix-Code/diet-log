/**
 * @file tabs.js
 * @description Configuració i gestió de la navegació entre les pestanyes principals (Dades / Serveis),
 *              incloent la funcionalitat de swipe per a dispositius tàctils.
 * @module tabs
 */

// Importa la funció per actualitzar estils des de servicesPanelManager
import { updateExternalStylesForCurrentService } from "../services/servicesPanelManager.js"; // Ajusta la ruta si cal

// --- Constants ---
const TABS = {
  DADES: "dades",
  SERVEIS: "serveis",
};
const DOM_IDS = {
  TAB_DADES: `tab-${TABS.DADES}`,
  TAB_SERVEIS: `tab-${TABS.SERVEIS}`,
  CONTENT_DADES: `${TABS.DADES}-tab-content`,
  CONTENT_SERVEIS: `${TABS.SERVEIS}-tab-content`,
  MAIN_CONTENT_AREA: "main-content", // ID del contenidor principal on es farà swipe
};
const CSS_CLASSES = {
  ACTIVE_TAB: "active", // Classe per a la pestanya i contingut actiu
  ERROR_TAB: "error-tab", // Classe per indicar error en una pestanya
};
const SWIPE_CONFIG = {
  MIN_DISTANCE: 60, // Distància horitzontal mínima en píxels per considerar-ho un swipe
  MAX_VERTICAL_RATIO: 0.5, // Ratio màxim vertical/horitzontal per no confondre amb scroll
};

// --- Variables d'Estat del Mòdul ---
let currentTab = TABS.DADES; // Inicialitza amb la pestanya per defecte
let touchStartX = 0;
let touchStartY = 0;
let isSwipeEnabled = true;

// --- Funcions Públiques / Exportades ---

/** Retorna l'ID de la pestanya actualment activa ('dades' o 'serveis'). */
export function getCurrentTab() {
  return currentTab;
}

/**
 * Configura els listeners inicials per a les pestanyes, incloent els de swipe.
 * @export
 */
export function setupTabs() {
  const tabDadesElement = document.getElementById(DOM_IDS.TAB_DADES);
  const tabServeisElement = document.getElementById(DOM_IDS.TAB_SERVEIS);

  if (!tabDadesElement || !tabServeisElement) {
    console.error("Tabs: No s'han trobat els elements de les pestanyes.");
    return;
  }

  tabDadesElement.addEventListener("click", () => switchToTab(TABS.DADES));
  tabServeisElement.addEventListener("click", () => switchToTab(TABS.SERVEIS));

  // Configura els listeners per al gest de swipe
  _setupSwipeListeners();

  // Mostra la pestanya inicial per defecte
  switchToTab(currentTab);
  console.log("Sistema de pestanyes (amb swipe) configurat.");
}

// --- Funcions Privades ---

/**
 * Canvia la visualització a la pestanya especificada.
 * @param {('dades'|'serveis')} tabName - L'ID de la pestanya a activar.
 */
function switchToTab(tabName) {
  if (currentTab === tabName && document.scrollingElement.scrollTop !== 0) {
    // Si fem clic a la pestanya ja activa, fem scroll cap amunt
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  // Evita canvis innecessaris si ja estem a la pestanya correcta
  if (currentTab === tabName) return;

  if (tabName !== TABS.DADES && tabName !== TABS.SERVEIS) {
    console.warn(`Intent de canviar a una pestanya invàlida: ${tabName}`);
    return;
  }
  //Fer scroll a dalt de la pàgina ABANS de canviar el contingut
  window.scrollTo({ top: 0, behavior: "auto" });
  // Actualitza l'estat intern
  currentTab = tabName;
  console.log(`Canviant a la pestanya: ${currentTab}`);

  const tabDadesElement = document.getElementById(DOM_IDS.TAB_DADES);
  const tabServeisElement = document.getElementById(DOM_IDS.TAB_SERVEIS);
  const dadesContentElement = document.getElementById(DOM_IDS.CONTENT_DADES);
  const serveisContentElement = document.getElementById(
    DOM_IDS.CONTENT_SERVEIS
  );

  if (
    !tabDadesElement ||
    !tabServeisElement ||
    !dadesContentElement ||
    !serveisContentElement
  ) {
    console.error(
      "Tabs: Falten elements de pestanya o contingut en switchToTab."
    );
    return;
  }

  tabDadesElement.classList.remove(CSS_CLASSES.ERROR_TAB);
  tabServeisElement.classList.remove(CSS_CLASSES.ERROR_TAB);

  const isDadesActive = tabName === TABS.DADES;

  tabDadesElement.classList.toggle(CSS_CLASSES.ACTIVE_TAB, isDadesActive);
  tabServeisElement.classList.toggle(CSS_CLASSES.ACTIVE_TAB, !isDadesActive);
  dadesContentElement.classList.toggle(CSS_CLASSES.ACTIVE_TAB, isDadesActive);
  serveisContentElement.classList.toggle(
    CSS_CLASSES.ACTIVE_TAB,
    !isDadesActive
  );

  if (tabName === TABS.SERVEIS) {
    if (typeof updateExternalStylesForCurrentService === "function") {
      updateExternalStylesForCurrentService();
    }
  }
}

/** Configura els listeners d'esdeveniments tàctils a l'àrea de contingut. */
function _setupSwipeListeners() {
  const contentArea = document.getElementById(DOM_IDS.MAIN_CONTENT_AREA);
  if (!contentArea) {
    console.error(
      `Swipe: No s'ha trobat l'àrea de contingut principal #${DOM_IDS.MAIN_CONTENT_AREA}.`
    );
    return;
  }

  // Usem { passive: true } per a una millor performance, ja que no prevenim el scroll
  contentArea.addEventListener("touchstart", _handleTouchStart, {
    passive: true,
  });
  contentArea.addEventListener("touchend", _handleTouchEnd, { passive: true });
}

/** Guarda la posició inicial quan l'usuari toca la pantalla. */
function _handleTouchStart(event) {
  // Si el swipe no està habilitat, no fem res.
  if (!isSwipeEnabled) return;

  const firstTouch = event.touches[0];
  touchStartX = firstTouch.clientX;
  touchStartY = firstTouch.clientY;
}

/** Calcula la direcció del gest quan l'usuari aixeca el dit i canvia de pestanya si cal. */
function _handleTouchEnd(event) {
  if (!isSwipeEnabled || touchStartX === 0) return;
  if (!event.changedTouches || event.changedTouches.length === 0) {
    return;
  }

  const touchEndX = event.changedTouches[0].clientX;
  const touchEndY = event.changedTouches[0].clientY;

  const deltaX = touchEndX - touchStartX;
  const deltaY = touchEndY - touchStartY;

  // Reseteja les coordenades per al proper gest, independentment del resultat
  touchStartX = 0;
  touchStartY = 0;

  // Ignora el gest si el moviment vertical és dominant (scroll)
  // Comprovem si el moviment vertical és més de la meitat de l'horitzontal
  if (Math.abs(deltaY) > Math.abs(deltaX) * SWIPE_CONFIG.MAX_VERTICAL_RATIO) {
    return;
  }

  // Comprova si el moviment horitzontal supera la distància mínima per a un swipe
  if (Math.abs(deltaX) > SWIPE_CONFIG.MIN_DISTANCE) {
    if (deltaX > 0) {
      // Swipe cap a la DRETA -> Va a la pestanya de l'ESQUERRA
      if (currentTab === TABS.SERVEIS) {
        switchToTab(TABS.DADES);
      }
    } else {
      // Swipe cap a l'ESQUERRA -> Va a la pestanya de la DRETA
      if (currentTab === TABS.DADES) {
        switchToTab(TABS.SERVEIS);
      }
    }
  }
}

// >>> NOVA FUNCIÓ EXPORTADA <<<
/**
 * Habilita o deshabilita la funcionalitat de swipe per canviar de pestanya.
 * @param {boolean} enable - Posa a 'true' per habilitar, 'false' per deshabilitar.
 */
export function setSwipeEnabled(enable) {
  isSwipeEnabled = !!enable; // Assegurem que sigui un booleà
  console.log(
    `La detecció de swipe està ara ${
      isSwipeEnabled ? "HABILITADA" : "DESHABILITADA"
    }.`
  );
}
