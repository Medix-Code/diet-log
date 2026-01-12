// src/init.js

// Imports dels mòduls necessaris en ordre: estandard, locals, relatius
import { DOM_IDS, LS_IDS } from "./config/constants.js";
import * as formService from "./services/formService.js";
import { initOnboarding } from "./ui/onboarding.js";
import {
  openDatabase,
  cleanupOldDeletedDiets,
} from "./db/indexedDbDietRepository.js";
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

function toggleVersionBadgeForEnv() {
  const versionEl = document.querySelector(".version-text");
  if (!versionEl) return;

  const hostname = window.location?.hostname || "";
  const isLocalhost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.endsWith(".local");

  const appEnv = (window.__APP_ENV__ || "").toLowerCase();
  const shouldShow = isLocalhost || appEnv === "development";
  versionEl.hidden = !shouldShow;
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
          log.info(
            `Auto-cleanup: ${deletedCount} dietes antigues eliminades de la paperera`
          );
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

    toggleVersionBadgeForEnv();

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

    // Mostrar modal de notificació de versió si cal
    showVersionNotificationIfNeeded();
  } catch (error) {
    log.error("Error en la inicialització de l'app:", error);
  }
}

/**
 * Mostra un modal de notificació de nova versió (només una vegada)
 * Espera fins que l'onboarding estigui completat abans de mostrar-se
 */
function showVersionNotificationIfNeeded() {
  const CURRENT_VERSION = "2.4.0";
  const LS_VERSION_KEY = "diet-log-last-version-seen";
  const ONBOARDING_KEY = "onboardingCompleted";

  function tryShowModal() {
    // Si l'onboarding no s'ha completat, esperem més
    const onboardingCompleted = JSON.parse(
      localStorage.getItem(ONBOARDING_KEY) || "false"
    );
    if (!onboardingCompleted) {
      // Tornar a intentar en 500ms
      setTimeout(tryShowModal, 500);
      return;
    }

    const lastVersionSeen = localStorage.getItem(LS_VERSION_KEY);
    if (lastVersionSeen === CURRENT_VERSION) return;

    log.info(`Nova versió detectada: ${CURRENT_VERSION}`);

    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,18,51,0.7);display:flex;align-items:center;justify-content:center;z-index:10000;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);animation:fadeIn 0.3s ease";

    const modal = document.createElement("div");
    modal.style.cssText =
      "background:linear-gradient(145deg,#ffffff 0%,#f8faff 100%);color:#1a1a2e;border-radius:16px;padding:24px;max-width:380px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,74,173,0.25),0 0 0 1px rgba(0,74,173,0.1);animation:slideUp 0.3s ease";

    modal.innerHTML = `
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        #versionNotificationBtn:hover { background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%) !important; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,0.4) !important; }
        #versionNotificationBtn:active { transform: translateY(0); }
      </style>
      <div style="text-align:center">
        <div style="width:56px;height:56px;margin:0 auto 16px;background:linear-gradient(135deg,#004aad 0%,#0066cc 100%);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(0,74,173,0.3)">
          <span style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.1))">🔐</span>
        </div>
        <h2 style="margin:0 0 8px 0;font-size:20px;font-weight:700;color:#1a1a2e;letter-spacing:-0.3px">Actualización de Seguridad</h2>
        <p style="margin:0 0 16px 0;font-size:13px;color:#8a8aa3">Versión ${CURRENT_VERSION}</p>
        <div style="background:linear-gradient(135deg,#fff8e6 0%,#fff3cd 100%);border-left:3px solid #f0a500;border-radius:10px;padding:14px;margin-bottom:16px;text-align:left">
          <p style="margin:0 0 10px 0;line-height:1.6;font-size:14px;color:#5a5a72">Por mejoras de seguridad, es posible que <strong style="color:#1a1a2e">algunas dietas antiguas no se puedan editar</strong>.</p>
          <div style="background:linear-gradient(135deg,#e8f4fd 0%,#d6ecfa 100%);padding:10px 12px;border-radius:8px;display:flex;align-items:flex-start;gap:8px">
            <span style="color:#004aad;font-size:16px">✓</span>
            <p style="margin:0;line-height:1.5;font-size:13px;color:#004aad;font-weight:500">Aunque no puedas editarlas, <strong>sí podrás descargar el PDF</strong>.</p>
          </div>
        </div>
        <p style="margin:0 0 18px 0;font-size:13px;color:#8a8aa3;line-height:1.5">Las nuevas dietas funcionarán sin problemas.<br><strong style="color:#5a5a72">Disculpa las molestias.</strong></p>
        <button id="versionNotificationBtn" style="background:linear-gradient(135deg,#004aad 0%,#0056b3 100%);color:white;border:none;border-radius:10px;padding:14px 28px;font-size:15px;font-weight:600;cursor:pointer;width:100%;box-shadow:0 4px 16px rgba(0,74,173,0.3);transition:all 0.2s ease">Entendido</button>
      </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Bloquejar scroll del body mentre el modal està obert
    document.body.style.overflow = "hidden";

    document
      .querySelector("#versionNotificationBtn")
      .addEventListener("click", () => {
        document.body.style.overflow = ""; // Restaurar scroll
        document.body.removeChild(overlay);
        localStorage.setItem(LS_VERSION_KEY, CURRENT_VERSION);
        log.info("Modal de versió tancat i marcat com a vist");
      });
  }

  // Començar a comprovar després de 500ms
  setTimeout(tryShowModal, 500);
}
