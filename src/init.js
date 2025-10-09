// src/init.js

// Imports dels mòduls necessaris
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

// Constants per la inicialització
const DONATION_LINK_ID = "openDonation";
const LS_SERVICE_TYPE_KEY = "userSelectedServiceType"; // Clau per localStorage

// Funcions internes d'inicialització
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

function setupOfflineIndicator() {
  const offlineIndicator = document.getElementById("offline-indicator");
  if (!offlineIndicator) return;

  function updateOfflineStatus() {
    if (!navigator.onLine) {
      offlineIndicator.hidden = false;
    } else {
      offlineIndicator.hidden = true;
    }
  }

  updateOfflineStatus();

  window.addEventListener("online", updateOfflineStatus);
  window.addEventListener("offline", updateOfflineStatus);
}

export async function initializeApp() {
  try {
    console.log("initializeApp() iniciant...");

    // Prepara dades bàsiques
    setTodayDate();
    setDefaultDietSelect();
    await openDatabase();

    // Llança serveis interns
    initServices();
    initSignature();
    dotacionService.init();
    initCameraOcr();

    // Configura interfície d'usuari
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

    // Prepara validacions i listeners del formulari
    setupServiceNumberRestrictions();
    setupNameAndVehicleInputSanitizers();
    formService.addInputListeners();
    formService.addServiceTypeListener();
    formService.addDoneBehavior();

    // Carrega preferència de tipus de servei
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

    // Guardo estat inicial del formulari
    formService.captureInitialFormState();

    // Altres coses
    easterEgg();
    initCookieConsentService();

    // Indicador de connexió
    setupOfflineIndicator();

    console.log("initializeApp() completada.");
  } catch (error) {
    console.error("Error en la inicialització de l'app:", error);
  }
}
