/**
 * @file constants.js
 * @description Centralització de constants per al projecte diet-log.
 * Inclou DOM IDs, selectors CSS, validacions, missatges, etc.
 */

// --- DOM Element IDs ---
export const DOM_IDS = {
  // Genèrics
  DATE_INPUT: "date",
  DIET_TYPE_SELECT: "diet-type",
  TOP_BAR: ".top-bar",
  FOOTER: "footer",
  EASTER_EGG_OVERLAY: ".easter-egg-overlay",
  EASTER_EGG_ICON: ".easter-egg-icon",

  // Serveis
  SERVICE_NUMBER_PREFIX: "service-number-",
  VEHICLE_INPUT: "vehicle-number",
  PERSON1_INPUT: "person1",
  PERSON2_INPUT: "person2",

  // Tabs
  TAB_DADES: "tab-dades",
  TAB_SERVEIS: "tab-serveis",
  CONTENT_DADES: "dades-tab-content",
  CONTENT_SERVEIS: "serveis-tab-content",
  MAIN_CONTENT_AREA: "main-content",

  // Servicis (opcions)
  CONTAINER: "services-container",
  BUTTONS_CONTAINER: "service-buttons-container",
  OPTIONS_MENU: "options-menu",
  OPTIONS_TOGGLE_BTN: "options-toggle",
  CLEAR_BTN: "clear-selected-service",
  CAMERA_BTN: "camera-in-dropdown",
  CHIP_GROUP: "service-mode-chips",

  // Modals
  SIGNATURE_MODAL: "signature-modal",
  CANVAS: "signature-canvas",
  CANCEL_BTN: "signature-cancel",
  ACCEPT_BTN: "signature-accept",
  SIGN_PERSON1_BTN: "sign-person1",
  SIGN_PERSON2_BTN: "sign-person2",
  TITLE: "signature-title",

  // Modals generals
  DOTACIO_MODAL: "dotacio-modal",
  OPTIONS_CONTAINER_DOT: "dotacio-options",
  TEMPLATE: "dotacio-template",
  NO_DOTACIO_TEXT: "no-dotacio-text",
  ADD_BTN: "add-dotacio",
  OPEN_MODAL_BTN: "open-dotacio-modal",
  CLOSE_MODAL_BTN: "close-dotacio-modal",

  DIET_MODAL: "diet-modal",
  DIET_OPTIONS_LIST: "diet-options",
  NO_DIETS_TEXT: "no-diets-text",
  CONFIRM_MODAL: "confirm-modal",
  CONFIRM_MESSAGE: "confirm-message",
  CONFIRM_TITLE: ".modal-title",
  CONFIRM_YES_BTN: "confirm-yes",
  CONFIRM_NO_BTN: "confirm-no",
  ABOUT_MODAL: "about-modal",
  CAMERA_GALLERY_MODAL: "camera-gallery-modal",

  // Camera/OCR
  CAMERA_MODAL: "camera-gallery-modal",
  MODAL_CONTENT: ".modal-bottom-content",
  OPTION_CAMERA: "option-camera",
  OPTION_GALLERY: "option-gallery",
  CAMERA_INPUT: "camera-input",

  OCR_PROGRESS_CONTAINER: ".ocr-progress-container",
  OCR_PROGRESS_TEXT: ".ocr-progress-text",
  OCR_SCAN_BTN: ".btn-ocr-inline",

  // Botons principals
  SAVE_DIET: "save-diet",
  NOTES_BUTTON_ID: "notes-selected-service",
  NOTES_MODAL_ID: "notes-modal",
  NOTES_TITLE_ID: "notes-title",
  NOTES_TEXTAREA_ID: "notes-textarea",
  NOTES_SAVE_ID: "notes-save",
  NOTES_CANCEL_ID: "notes-cancel",
  NOTES_COUNTER_ID: "notes-char-counter",

  // Settings
  SETTINGS_BTN: "settings",
  SETTINGS_PANEL: "settings-panel",
  TOGGLE_BTN: "theme-toggle-btn",
  THEME_ICON: "theme-icon",
  THEME_TEXT: "theme-btn-text",

  // Toast
  SAVE_PILL: "save-pill",

  // Altres
  DONATION_LINK_ID: "openDonation",
  COOKIE_CONSENT_BANNER: "cookie-consent-banner",
  ACCEPT_COOKIES: "accept-cookies",
  DECLINE_COOKIES: "decline-cookies",
};

// --- CSS Classes ---
export const CSS_CLASSES = {
  // Genèrics
  INPUT_ERROR: "input-error",
  ACTIVE_TAB: "active",
  ERROR_TAB: "error-tab",
  MODAL_OPEN: "modal-open",
  MODAL_VISIBLE: "visible",
  MODAL_OPEN_BODY: "modal-open",
  HIDDEN: "hidden",

  // Easter Egg
  TOP_BAR_TAPS: 3,
  FOOTER_TAPS: 2,
  TIMEOUT: 1000,
  ANIMATION_DURATION: 1000,

  // Toast
  DEFAULT_DURATION: 3000,
  ALLOWED_TYPES: ["info", "success", "error", "warning"],
  MAX_QUEUE_SIZE: 10,
  ANIMATION: {
    ENTER: "toast-enter",
    EXIT: "toast-exit",
  },
  UNDO_BTN_CLASS: "toast-undo-btn",
  DEFAULT_PRIORITY: 1,

  // Serveis
  SERVICE_HIDDEN: "hidden",
  BUTTON_ACTIVE: "active-square",
  CHIP_ACTIVE: "chip-active",

  // Settings
  PANEL_VISIBLE: "visible",
  BUTTON_OPEN: "open",

  // Diet modal
  DIET_ITEM: "diet-item",
  DIET_DATE: "diet-date",
  DIET_ICONS: "diet-icons",
  DIET_LOAD_BTN: "diet-load",
  DIET_DELETE_BTN: "diet-delete",
  LIST_ITEM_BTN: "list-item-btn",
  LIST_ITEM_BTN_LOAD: "list-item-btn--load",
  LIST_ITEM_BTN_DELETE: "list-item-btn--delete",
  DIET_ITEM_SWIPING: "swiping",
  DIET_DELETE_REVEAL: "delete-reveal",

  // Dotació
  INPUT_ERROR_DOT: "input-error",

  // PWA
  IS_INSTALLED: "pwa_isInstalled",
  PROMPT_DISMISSED_COUNT: "pwa_promptDismissedCount",
  NEVER_SHOW_AGAIN: "pwa_neverShowAgain",
  ACTION_TRIGGER_COUNT: "pwa_actionTriggerCount",
  PROMPT_DISMISSED_LIMIT: 2,
  ACTION_TRIGGER_LIMIT: 10,

  // Theme
  DARK_THEME: "theme-dark",

  // Save Indicator
  VISIBLE: "visible",
  HAS_CHANGES: "has-changes",
  SAVING: "saving",
  HAS_SAVED: "has-saved",
  ERROR: "error",

  // Signature
  SIGNED: "signed",

  // RIA
  MODAL_CLOSE_BTN: ".close-modal, .close-modal-btn",
  MODAL_TRIGGER: 'a[href^="#"]',
  FOCUSABLE_ELEMENTS:
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
};

// --- Selectors CSS ---
export const SELECTORS = {
  SERVICE_PANEL: ".service",
  SERVICE_BUTTON: ".service-button",
  CHIP: ".chip",
  FORM_GROUP: ".form-group",
  PERSON_INPUT_GROUP: ".input-with-icon",
  TEXT_SEL: ".pill-text",
  SERVICE_CONTAINER_SELECTOR: ".service",
  DOTACIO_INFO: ".dotacio-info",
  LOAD_BTN: ".dotacio-load",
  DELETE_BTN: ".dotacio-delete",
  SERVICE_NUMBER_INPUT: ".service-number",
};

// --- Validation Rules ---
export const VALIDATION_RULES = {
  SERVICE_NUMBER_LENGTH: 9,
  VEHICLE_MAX_LENGTH: 6,
  PERSON_NAME_MAX_LENGTH: 28,
  LOCATION_MAX_LENGTH: 35,
  PERSON_NAME_ALLOWED_CHARS:
    /^[a-zA-Z\s'’áéíóúàèìòùäëïöüñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑÇ]+$/u,
};

// --- Timeouts and Delays ---
export const TIMEOUTS = {
  DEBOUNCE_TOAST: 300,
  DEBOUNCE_AUTO_SAVE: 1000,
  DEBOUNCE_HANDLER: 800,
};

// --- Service Types ---
export const SERVICE_TYPES = ["3.6", "3.51", "3.22", "3.11"];
export const DIET_TYPES = { LUNCH: "lunch", DINNER: "dinner" };

// --- Messages ---
export const MESSAGES = {
  // Validation errors
  SERVICE_NUMBER_DIGITS_ONLY:
    "Solo se permiten dígitos (0-9) en el número de servicio.",
  SAVE_ERROR_DIGITAL_ONLY: "El número de servicio debe contener solo dígitos.",

  // Generic
  VALIDATION_FAILED: "Validación fallida",

  // OCR
  OCR_PROCESS_RUNNING: "Proceso OCR ya en marcha.",
  INVALID_IMAGE: "Selecciona una imagen.",
  IMAGE_TOO_BIG: "La imagen es demasiado grande (máx. 10 MB).",
  OCR_ERROR: "Error de escaneo",
  IMAGE_PROCESS_ERROR: "Error al procesar la imagen.",
  OCR_COMPLETE: "Análisis completado.",

  // Save
  SAVING: "Guardando…",
  SAVED: "Guardado",
  SAVE_ERROR: "No se pudo guardar",

  // PDF
  DOWNLOAD_STARTED: "Descarga iniciada correctamente.",
  PDF_GENERATION_ERROR: "Error en la generación del PDF",

  // Dotacio
  DOTACIO_SAVED: "Dotación guardada.",
  DOTACIO_LOADED: "Dotación cargada.",
  DOTACIO_DELETED: "Dotación eliminada.",
};

// --- OCR Config ---
export const OCR_CONFIG = {
  WORKER: {
    LANG: "spa",
    PSM: 6, // uniform block of text
  },
  PARAMS: {
    tessedit_char_whitelist:
      "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:/-ÀÉÍÓÚÈÌÒÙÄËÏÖÜÑÇàéíóúèìòùäëïöüñç",
    tessedit_pageseg_mode: 6,
    load_system_dawg: false,
    load_freq_dawg: false,
  },
  IMAGE_PROCESING: {
    MAX_DIM: 1500,
    QUALITY: 0.95,
    FORMAT: "image/png",
    MAX_SIZE_MB: 10,
  },
  PROGRESS_MESSAGES: {
    PREPARING: "Preparando imagen...",
    LOADING_ENGINE: "Cargando motor OCR...",
    RECOGNIZING: "Reconociendo texto",
    LOADING_MODEL: "Cargando modelo de idioma...",
  },
};

// --- IDs Local Storage ---
export const LS_IDS = {
  DOTACIIONS: "dotacions_v2",
  ANONYMOUS_USER: "anonymousUserId",
  COOKIE_CONSENT: "cookie_consent",
  THEME_PREFERENCE: "themePreference",
  USER_SELECTED_SERVICE_TYPE: "userSelectedServiceType",
  ONBOARDING_COMPLETED: "onboardingCompleted",
};

// --- Altres configs ---
export const THEME_OPTIONS = {
  LIGHT: "light",
  DARK: "dark",
};

export const SERVICE_BUTTON_COLORS = [
  "service-1",
  "service-2",
  "service-3",
  "service-4",
];

export const GESTURE_CONFIG = {
  MIN_DISTANCE: 60,
  MAX_VERTICAL_RATIO: 0.5,
};

// Exportar TOTS per compatibilitat
export default {
  DOM_IDS,
  CSS_CLASSES,
  SELECTORS,
  VALIDATION_RULES,
  TIMEOUTS,
  SERVICE_TYPES,
  DIET_TYPES,
  MESSAGES,
  OCR_CONFIG,
  LS_IDS,
  THEME_OPTIONS,
  SERVICE_BUTTON_COLORS,
  GESTURE_CONFIG,
};
