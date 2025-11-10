// src/init.js

// Imports dels mòduls necessaris en ordre: estandard, locals, relatius
import { DOM_IDS, LS_IDS } from "./config/constants.js";
import * as formService from "./services/formService.js";
import { initOnboarding } from "./ui/onboarding.js";
import { openDatabase, cleanupOldDeletedDiets } from "./db/indexedDbDietRepository.js";
import {
  setTodaysDate,
  setupDietTypeSelectBehaviour,
  activateEasterEgg,
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
import { initTrashModal } from "./ui/modals/trashModal.js";
import { setupDatePickers, setupTimePickers } from "./ui/pickers.js";
import { setupServiceNumberRestrictions } from "./utils/restrictions.js";
import { initSettingsPanel } from "./ui/settingsPanel.js";
import { initCameraOcr } from "./services/cameraOcr.js";
import { dotacionService } from "./services/dotacion.js";
import { getAnonymousUserId } from "./services/userService.js";
import "./ui/keyboardHandler.js";
import "./ui/focusScrollHandler.js";
import { setupNameAndVehicleInputSanitizers } from "./utils/validation.js";
import { setupNotesSelectedService } from "./services/notesService.js";
import { initCookieConsentService } from "./services/cookieConsentService.js";
import { initLocationSuggestions } from "./services/locationSuggestions.js";
import { logger } from "./utils/logger.js";

// Sistema d'encriptació i migració
import {
  EncryptionSupportError,
  initializeKeySystem,
  isEncryptionEnvironmentSupported,
} from "./utils/keyManager.js";
import { dataMigration } from "./services/dataMigration.js";
import { exposeDebugFunctions } from "./utils/keySystemDebug.js";

const log = logger.withScope("Init");

/**
 * Funcions internes d'inicialització
 */
/**
 * Configura l'enllaç de donació amb ID anònim de l'usuari
 */
function setupDonationLink() {
  const donationLink = document.getElementById(DOM_IDS.DONATION_LINK_ID);
  if (!donationLink) return log.warn("No s'ha trobat l'enllaç de donació.");

  const userId = getAnonymousUserId();
  try {
    const url = new URL(donationLink.href);
    url.searchParams.set("custom", userId);
    donationLink.href = url.toString();
    log.info("Enllaç de donació actualitzat amb ID anònim.");
  } catch (error) {
    log.error("Error modificant l'URL de donació:", error);
  }
}

export async function initializeApp() {
  try {
    log.info("initializeApp() iniciant...");

    // 🔐 FASE 1: Inicialitzar sistema d'encriptació (primer de tot!)
    let encryptionAvailable = true;
    if (!isEncryptionEnvironmentSupported()) {
      encryptionAvailable = false;
      const fallbackReason =
        "⚠️ Aquest navegador no permet inicialitzar l'encriptació (IndexedDB o WebCrypto no disponibles). Les dotacions es guardaran sense xifrar.";
      dotacionService.setEncryptionSupport(false, fallbackReason);
      log.warn(
        "Entorn sense suport d'encriptació. Es continua sense xifrar dotacions.",
        new Error("Unsupported encryption environment")
      );
    } else {
      try {
        log.debug("🔐 Inicialitzant sistema de claus...");
        await initializeKeySystem();
        log.debug("✅ Sistema de claus inicialitzat");
      } catch (keyError) {
        encryptionAvailable = false;
        const fallbackReason =
          keyError instanceof EncryptionSupportError && keyError.message
            ? `⚠️ ${keyError.message} Les dotacions es guardaran sense xifrar temporalment.`
            : "⚠️ No s'ha pogut inicialitzar l'encriptació. Les dotacions es guardaran sense xifrar fins que es resolgui el problema.";
        dotacionService.setEncryptionSupport(false, fallbackReason);
        log.warn(
          "Error inicialitzant sistema de claus (continuant sense encriptació):",
          keyError
        );
      }
    }

    // Prepara dades bàsiques
    setTodaysDate();
    setupDietTypeSelectBehaviour();
    await openDatabase();

    // 🔄 FASE 2: Migració automàtica de dietes antigues (en background)
    setTimeout(async () => {
      try {
        log.debug("🔄 Executant migració automàtica...");
        const result = await dataMigration.runIfNeeded();
        log.debug("📊 Resultat migració:", result);
      } catch (migrationError) {
        log.error("Error en migració automàtica:", migrationError);
        // No bloquejar l'app per errors de migració
      }
    }, 1000); // Esperar 1 segon per no bloquejar la càrrega inicial

    // Llança serveis interns
    initServices();
    initSignature();
    await dotacionService.init(); // Async per encriptació
    initCameraOcr();
    initLocationSuggestions();

    // Configura interfície d'usuari
    initOnboarding();
    setupTabs();
    setupMainButtons();
    setupClearSelectedService();
    setupNotesSelectedService(); // Ja definit gràcies a l'import nou
    setupModalGenerics();

    // Inicialitzar modal de paperera després que el DOM estigui llest
    setTimeout(() => {
      initTrashModal();
    }, 100);

    setupDatePickers();
    setupTimePickers();
    initSettingsPanel();
    initThemeSwitcher();
    setupDonationLink();

    // 🗑️ Neteja automàtica de dietes antigues a la paperera (30 dies)
    setTimeout(async () => {
      try {
        const deletedCount = await cleanupOldDeletedDiets(30);
        if (deletedCount > 0) {
          log.info(`Auto-cleanup: ${deletedCount} dietes antigues eliminades de la paperera`);
        }
      } catch (error) {
        log.error("Error en auto-cleanup de paperera:", error);
      }
    }, 2000); // Esperar 2 segons per no bloquejar la càrrega inicial

    // Prepara validacions i listeners del formulari
    setupServiceNumberRestrictions();
    setupNameAndVehicleInputSanitizers();
    formService.addInputListeners();
    formService.addServiceTypeListener();
    formService.addDoneBehavior();

    // Carrega preferència de tipus de servei
    const serviceTypeSelect = document.getElementById("service-type");
    if (serviceTypeSelect) {
      const savedServiceType = localStorage.getItem(
        LS_IDS.USER_SELECTED_SERVICE_TYPE
      );
      if (savedServiceType === "TSU" || savedServiceType === "TSNU") {
        serviceTypeSelect.value = savedServiceType;
        log.debug(
          `[LocalStorage] Carregat tipus de servei: ${savedServiceType}`
        );
      }
      updateServicePanelsForServiceType(serviceTypeSelect.value);
    }

    // Guardo estat inicial del formulari
    formService.captureInitialFormState();

    // Altres coses
    activateEasterEgg();
    initCookieConsentService();

    // Exposar funcions de debug (només en development/test)
    if (
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1"
    ) {
      exposeDebugFunctions();
      log.debug("🛠️ Funcions de debug exposades (mode development)");
    }

    log.info("initializeApp() completada.");
  } catch (error) {
    log.error("Error en la inicialització de l'app:", error);
  }
}
