// src/init.js

// --- Importacions de Mòduls ---
import { openDatabase } from "./db/indexedDbDietRepository.js";
import {
  setTodayDate,
  easterEgg,
  setDefaultDietSelect,
} from "./utils/utils.js";
import {
  initServices,
  updateServicePanelsForServiceType,
} from "./services/servicesPanelManager.js";
import { initSignature } from "./services/signatureService.js";
import { setupTabs } from "./ui/tabs.js";
import { initThemeSwitcher } from "./ui/theme.js";
import { setupMainButtons } from "./ui/mainButtons.js";
import { setupClearSelectedService } from "./ui/clearService.js";
import { setupModalGenerics } from "./ui/modals.js";
import { setupDatePickers, setupTimePickers } from "./ui/pickers.js";
import { setupServiceNumberRestrictions } from "./utils/restrictions.js";
import { initSettingsPanel } from "./ui/settingsPanel.js";
import * as formService from "./services/formService.js"; // Importem tot el mòdul
import { initPwaInstall } from "./services/pwaService.js";
import { initCameraOcr } from "./services/cameraOcr.js";
import { initDotacion } from "./services/dotacion.js";
import { getAnonymousUserId } from "./services/userService.js";

// --- Constants Específiques d'Inicialització ---
const DONATION_LINK_ID = "openDonation";
const LS_SERVICE_TYPE_KEY = "userSelectedServiceType"; // Clau per a localStorage

// --- Funcions Privades d'Inicialització ---

/**
 * Modifica l'enllaç de donació per incloure l'ID anònim de l'usuari.
 */
function setupDonationLink() {
  const donationLink = document.getElementById(DONATION_LINK_ID);
  if (!donationLink) {
    console.warn("No s'ha trobat l'enllaç de donació per modificar.");
    return;
  }

  const userId = getAnonymousUserId();

  try {
    const url = new URL(donationLink.href);
    url.searchParams.set("custom", userId); // Usem el paràmetre 'custom' de PayPal
    donationLink.href = url.toString();
    console.log("Enllaç de donació actualitzat amb ID d'usuari anònim.");
  } catch (error) {
    console.error("L'URL de l'enllaç de donació no és vàlida:", error);
  }
}

/**
 * Funció principal que orquestra la inicialització de tota l'aplicació.
 * S'executa quan el DOM està llest.
 */
export async function initializeApp() {
  console.log("initializeApp() iniciant...");

  // --- Inicialitzacions bàsiques i dades ---
  setTodayDate();
  setDefaultDietSelect();
  await openDatabase();

  // --- Inicialització de Serveis de Fons ---
  initServices();
  initSignature();
  initDotacion();
  initCameraOcr();

  // --- Configuració de la Interfície d'Usuari (UI) ---
  setupTabs();
  setupMainButtons();
  setupClearSelectedService();
  setupModalGenerics();
  setupDatePickers();
  setupTimePickers();
  initSettingsPanel();
  initThemeSwitcher();
  setupDonationLink();

  // --- Configuració de Lògica de Formulari i Validacions ---
  setupServiceNumberRestrictions();
  formService.addInputListeners();
  formService.addServiceTypeListener(); // Aquest listener ja està definit a la teva versió anterior
  formService.addDoneBehavior();

  // Lògica per a la preferència de tipus de servei
  const serviceTypeSelect = document.getElementById("service-type");
  if (serviceTypeSelect) {
    const savedServiceType = localStorage.getItem(LS_SERVICE_TYPE_KEY);
    if (savedServiceType === "TSU" || savedServiceType === "TSNU") {
      serviceTypeSelect.value = savedServiceType;
      console.log(
        `[LocalStorage] Carregat tipus de servei: ${savedServiceType}`
      );
    }
    updateServicePanelsForServiceType(serviceTypeSelect.value);
  }

  // Captura l'estat inicial del formulari. Aquesta funció ara també
  // s'encarregarà de desactivar el botó de desar inicialment.
  try {
    formService.captureInitialFormState();
  } catch (e) {
    console.warn("No s'ha pogut desar l'estat inicial del formulari:", e);
  }

  // --- Inicialització del Servei PWA ---
  initPwaInstall();

  // --- Altres ---
  easterEgg();

  console.log("initializeApp() completada.");
}
