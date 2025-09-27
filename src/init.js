// src/init.js

// --- Importacions de Mòduls ---
import { initOnboarding } from "./ui/onboarding.js";
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
import * as formService from "./services/formService.js";
import { initCameraOcr } from "./services/cameraOcr.js";
import { dotacionService } from "./services/dotacion.js";
import { getAnonymousUserId } from "./services/userService.js";
import "./ui/keyboardHandler.js";
import "./ui/focusScrollHandler.js";
import { setupNameAndVehicleInputSanitizers } from "./utils/validation.js";
import { setupNotesSelectedService } from "./services/notesService.js";
import { initCookieConsentService } from "./services/cookieConsentService.js";

// --- Constants Específiques d'Inicialització ---
const DONATION_LINK_ID = "openDonation";
const LS_SERVICE_TYPE_KEY = "userSelectedServiceType"; // Clau per a localStorage

// --- Funcions Privades d'Inicialització ---
function setupDonationLink() {
  const donationLink = document.getElementById(DONATION_LINK_ID);
  if (!donationLink) return console.warn("No s'ha trobat l'enllaç de donació.");

  const userId = getAnonymousUserId();
  try {
    const url = new URL(donationLink.href);
    url.searchParams.set("custom", userId);
    donationLink.href = url.toString();
    console.log("Enllaç de donació actualitzat amb ID anònim.");
  } catch (error) {
    console.error("Error modificant l'URL de donació:", error);
  }
}

export async function initializeApp() {
  try {
    console.log("initializeApp() iniciant...");

    // --- Inicialitzacions bàsiques i dades ---
    setTodayDate();
    setDefaultDietSelect();
    await openDatabase();

    // --- Inicialització de Serveis de Fons ---
    initServices();
    initSignature();
    dotacionService.init();
    initCameraOcr();

    // --- Configuració de la Interfície d'Usuari (UI) ---
    initOnboarding();
    setupTabs();
    setupMainButtons();
    setupClearSelectedService();
    setupNotesSelectedService(); // Ja definit gràcies a l'import nou
    setupModalGenerics();
    setupDatePickers();
    setupTimePickers();
    initSettingsPanel();
    initThemeSwitcher();
    setupDonationLink();

    // --- Configuració de Lògica de Formulari i Validacions ---
    setupServiceNumberRestrictions();
    setupNameAndVehicleInputSanitizers();
    formService.addInputListeners();
    formService.addServiceTypeListener();
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

    // Captura l'estat inicial del formulari
    formService.captureInitialFormState();

    // --- Altres ---
    easterEgg();
    initCookieConsentService();

    console.log("initializeApp() completada.");
  } catch (error) {
    console.error("Error en la inicialització de l'app:", error);
  }
}
