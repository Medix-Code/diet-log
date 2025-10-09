/**
 * @file validation.js
 * @description Lógica para validar diferentes secciones del formulario con robustez.
 * @module formValidation
 */

import { showToast } from "../ui/toast.js";
import {
  DOM_IDS,
  CSS_CLASSES,
  VALIDATION_RULES,
  SELECTORS,
} from "../config/constants.js";

// --- Funciones Internas de Ayuda ---

/**
 * Marca un elemento como error.
 * @param {HTMLElement} element
 */
function markError(element) {
  element?.classList.add(CSS_CLASSES.INPUT_ERROR);
}

/**
 * Limpia la marca de error de un elemento.
 * @param {HTMLElement} element
 */
function clearError(element) {
  element?.classList.remove(CSS_CLASSES.INPUT_ERROR);
}

/**
 * Formatea una lista de servicios para mensajes de error.
 * @param {number[]} indexes
 * @returns {string}
 */
function formatServiceList(indexes) {
  if (!indexes || indexes.length === 0) return "";
  const sList = indexes.map((i) => `S${i}`);
  if (sList.length === 1) return sList[0];
  if (sList.length === 2) return sList.join(" y ");
  return `${sList.slice(0, -1).join(", ")} y ${sList[sList.length - 1]}`;
}

/**
 * Añade listener para limpiar error en input (una vez).
 * @param {HTMLElement} element
 */
function addInstantErrorClearListener(element) {
  if (!element || element.dataset.errorListenerAttached) return;
  element.addEventListener("input", () => clearError(element), { once: true });
  element.dataset.errorListenerAttached = "true";
}

/**
 * Valida un input de número de servicio.
 * @param {HTMLInputElement} inputElement
 * @param {number} serviceIndex
 * @param {boolean} isRequired
 * @param {Object} errorMap
 * @returns {boolean}
 */
function validateServiceNumberInput(
  inputElement,
  serviceIndex,
  isRequired,
  errorMap
) {
  if (!inputElement) return true;
  clearError(inputElement);
  const value = inputElement.value.trim();
  let hasError = false;

  if (!value) {
    if (isRequired) {
      errorMap.emptyRequiredS1 = true;
      hasError = true;
    }
  } else if (!/^\d+$/.test(value)) {
    errorMap.nonNumeric.push(serviceIndex);
    hasError = true;
  } else if (value.length !== VALIDATION_RULES.SERVICE_NUMBER_LENGTH) {
    errorMap.digitLength.push(serviceIndex);
    hasError = true;
  }

  if (hasError) {
    markError(inputElement);
    addInstantErrorClearListener(inputElement);
    return false;
  }
  return true;
}

/**
 * Convierte tiempo HH:MM a minutos.
 * @param {string} timeString
 * @returns {number} Minutos o NaN si inválido.
 */
function timeToMinutes(timeString) {
  if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) return NaN;
  const [hours, minutes] = timeString.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return hours * 60 + minutes;
}

/**
 * Genera mensajes de error para la validación de servicios.
 * @param {Object} errorMap
 * @returns {string[]}
 */
function generateErrorMessagesForServices(errorMap) {
  const messages = [];
  if (errorMap.nonNumeric.length > 0) {
    messages.push(
      `El número de servicio ${formatServiceList(
        errorMap.nonNumeric
      )} debe contener solo dígitos.`
    );
  }
  if (errorMap.digitLength.length > 0) {
    messages.push(
      `El número de servicio ${formatServiceList(
        errorMap.digitLength
      )} debe tener ${VALIDATION_RULES.SERVICE_NUMBER_LENGTH} dígitos.`
    );
  }
  return messages;
}

// --- Funciones de Validación Exportadas ---

/**
 * Valida la pestaña de datos.
 * @returns {boolean}
 * @export
 */
export function validateDadesTab() {
  let isValid = true;
  const fieldsToValidate = [
    document.getElementById(DOM_IDS.DATE_INPUT),
    document.getElementById(DOM_IDS.DIET_TYPE_SELECT),
  ].filter(Boolean);

  fieldsToValidate.forEach((field) => {
    clearError(field);
    if (!field.value.trim()) {
      markError(field);
      addInstantErrorClearListener(field);
      isValid = false;
    }
  });

  return isValid;
}

/**
 * Valida la pestaña de servicios.
 * @returns {boolean}
 * @export
 */
export function validateServeisTab() {
  const errorMap = {
    emptyRequiredS1: false,
    nonNumeric: [],
    digitLength: [],
  };
  let overallValid = true;

  const service1Input = document.getElementById(
    `${DOM_IDS.SERVICE_NUMBER_PREFIX}1`
  );
  if (!service1Input) {
    console.error(
      "Validation: No se ha encontrado el input para el servicio S1."
    );
    return false;
  }
  overallValid =
    validateServiceNumberInput(service1Input, 1, true, errorMap) &&
    overallValid;

  for (let i = 2; i <= 4; i++) {
    const serviceInputElement = document.getElementById(
      `${DOM_IDS.SERVICE_NUMBER_PREFIX}${i}`
    );
    if (serviceInputElement) {
      overallValid =
        validateServiceNumberInput(serviceInputElement, i, false, errorMap) &&
        overallValid;
    }
  }

  if (overallValid) return true;

  const errorMessages = generateErrorMessagesForServices(errorMap);
  if (errorMessages.length > 0) {
    showToast(errorMessages.join("\n"), "error");
  }

  return false;
}

/**
 * Valida consistencia de horarios en servicios.
 * @returns {boolean}
 * @export
 */
export function validateMinFieldsForSave() {
  return (
    validateDadesTab() &&
    validateServeisTab() &&
    validateDotacioTab() &&
    validateLocationFields()
  );
}

/**
 * Validación para generar PDF.
 * @returns {boolean}
 * @export
 */
export function validateForPdf() {
  return (
    validateDadesTab() &&
    validateServeisTab() &&
    validateDotacioTab() &&
    validateServiceTimesConsistency() &&
    validateLocationFields()
  );
}

/**
 * Limpia y sanea una cadena de texto.
 * 1. Elimina espacios en blanco al inicio y al final.
 * 2. Convierte caracteres HTML peligrosos para evitar ataques XSS.
 * @param {string} input - La cadena de texto a procesar.
 * @returns {string} - La cadena de texto limpia y saneada.
 */
export function sanitizeText(input) {
  if (typeof input !== "string") return "";

  const trimmedInput = input.trim();
  return trimmedInput.replace(/[<>&"'`]/g, "").trim();
}

/**
 * Valida si una cadena de texto tiene el formato de hora HH:mm (24h).
 * Permite que la cadena esté vacía (considerado válido en este contexto).
 * @param {string} timeStr - La cadena de texto a validar.
 * @returns {boolean} - True si el formato es válido o la cadena es vacía, false en caso contrario.
 */
export function isValidTimeFormat(timeStr) {
  if (!timeStr) return true;
  const timeRegex = /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
}

/**
 * Valida un campo de nombre de persona (conductor o ayudante).
 * @param {HTMLInputElement} input
 * @param {HTMLElement} group
 * @param {string} fieldName
 * @param {string[]} errorMessages
 * @returns {boolean}
 */
function validatePersonName(input, group, fieldName, errorMessages) {
  const value = input?.value.trim() || "";
  if (value && !VALIDATION_RULES.PERSON_NAME_ALLOWED_CHARS.test(value)) {
    markError(group);
    return false;
  }
  if (value.length > VALIDATION_RULES.PERSON_NAME_MAX_LENGTH) {
    markError(group);
    errorMessages.push(
      `El nombre del ${fieldName} no puede superar los ${VALIDATION_RULES.PERSON_NAME_MAX_LENGTH} caracteres.`
    );
    return false;
  }
  return true;
}

/**
 * Valida los campos de la dotación (Vehículo, Conductor, Ayudante).
 * @returns {boolean} - True si es válido, false si hay errores.
 * @export
 */
export function validateDotacioTab() {
  const vehicleInput = document.getElementById(DOM_IDS.VEHICLE_INPUT);
  const conductorInput = document.getElementById(DOM_IDS.PERSON1_INPUT);
  const ayudanteInput = document.getElementById(DOM_IDS.PERSON2_INPUT);
  const conductorGroup = conductorInput?.closest(SELECTORS.PERSON_INPUT_GROUP);
  const ayudanteGroup = ayudanteInput?.closest(SELECTORS.PERSON_INPUT_GROUP);

  clearError(vehicleInput);
  clearError(conductorGroup);
  clearError(ayudanteGroup);

  const vehicleValue = vehicleInput?.value.trim() || "";
  const conductorValue = conductorInput?.value.trim() || "";
  const ayudanteValue = ayudanteInput?.value.trim() || "";

  let isValid = true;
  const errorMessages = [];

  if (!vehicleValue) {
    markError(vehicleInput);
    errorMessages.push("El campo Vehículo es obligatorio.");
    isValid = false;
  }

  isValid =
    validatePersonName(
      conductorInput,
      conductorGroup,
      "Conductor",
      errorMessages
    ) && isValid;
  isValid =
    validatePersonName(
      ayudanteInput,
      ayudanteGroup,
      "Ayudante",
      errorMessages
    ) && isValid;

  if (!conductorValue && !ayudanteValue) {
    markError(conductorGroup);
    markError(ayudanteGroup);
    errorMessages.push("Debe indicar al menos un Conductor o Ayudante.");
    isValid = false;
  }

  if (!isValid) {
    addInstantErrorClearListener(vehicleInput);
    addInstantErrorClearListener(conductorInput);
    addInstantErrorClearListener(ayudanteInput);
    showToast(errorMessages.join("\n"), "error");
  }

  return isValid;
}

/**
 * Valida consistència horària entre serveis. Comprova que les hores de finalització siguin coherents amb les d'inici.
 * @returns {boolean} - True si les hores són consistents, false altrament.
 * @export
 */
export function validateServiceTimesConsistency() {
  let isValid = true;
  const errorMessages = [];

  const serviceElements = document.querySelectorAll(".service");
  serviceElements.forEach((serviceEl, index) => {
    const serviceNumber = index + 1;
    const activeChip = serviceEl.querySelector('.chip[class*="chip-active"]');
    const mode = activeChip ? activeChip.dataset.mode : "3.6";

    const originTimeEl = serviceEl.querySelector(".origin-time");
    const destinationTimeEl =
      mode === "3.6" ? serviceEl.querySelector(".destination-time") : null;
    const endTimeEl = serviceEl.querySelector(".end-time");

    const originMinutes = timeToMinutes(originTimeEl?.value || "");
    const destinationMinutes = destinationTimeEl
      ? timeToMinutes(destinationTimeEl?.value || "")
      : null;
    const endMinutes = timeToMinutes(endTimeEl?.value || "");

    // Validacions bàsiques
    if (originMinutes !== NaN && endMinutes !== NaN) {
      if (endMinutes <= originMinutes) {
        errorMessages.push(
          `Servicio ${serviceNumber}: La hora de finalización debe ser posterior a la hora de movilización.`
        );
        markError(endTimeEl);
        addInstantErrorClearListener(endTimeEl);
        isValid = false;
      }
    }

    if (
      mode === "3.6" &&
      destinationMinutes !== null &&
      destinationMinutes !== NaN &&
      originMinutes !== NaN &&
      destinationMinutes <= originMinutes
    ) {
      errorMessages.push(
        `Servicio ${serviceNumber}: La hora de llegada al hospital debe ser posterior a la hora de movilización.`
      );
      markError(destinationTimeEl);
      addInstantErrorClearListener(destinationTimeEl);
      isValid = false;
    }
  });

  if (!isValid) {
    showToast(errorMessages.join("\n"), "error");
  }

  return isValid;
}

/**
 * Valida la longitud dels camps de text de localització (origen/destí)
 * per a tots els serveis.
 * @returns {boolean} - True si tots els camps són vàlids, false si algun excedeix la longitud.
 * @export
 */
export function validateLocationFields() {
  let isValid = true;
  const errorMessages = [];
  const locationInputs = document.querySelectorAll(
    ".service .origin, .service .destination"
  );

  locationInputs.forEach((input) => {
    clearError(input);
    const value = input.value.trim();
    if (value.length > VALIDATION_RULES.LOCATION_MAX_LENGTH) {
      const serviceContainer = input.closest(".service");
      const serviceNum = serviceContainer.className.match(/service-(\d)/)[1];
      const fieldType = input.classList.contains("origin")
        ? "Origen"
        : "Destino";

      errorMessages.push(
        `El campo ${fieldType} del Servicio ${serviceNum} no puede superar los ${VALIDATION_RULES.LOCATION_MAX_LENGTH} caracteres.`
      );
      markError(input);
      addInstantErrorClearListener(input);
      isValid = false;
    }
  });

  if (!isValid) {
    showToast(errorMessages.join("\n"), "error");
  }

  return isValid;
}

export function setupNameAndVehicleInputSanitizers() {
  const allowedCharsRegex = VALIDATION_RULES.PERSON_NAME_ALLOWED_CHARS;

  // Regex per camps de localització (orígens/destinacions): permet lletres, números, espais, guions, punts, cometes... però bloqueja < > & " '
  const allowedLocationCharsRegex = /^[^\x00-\x1F\x7F<>&"'`]*$/u;

  // Funció auxiliar per filtrar en temps real noms
  function handleNameInput(e) {
    const value = e.target.value;
    if (!allowedCharsRegex.test(value)) {
      e.target.value = value.replace(
        /[^a-zA-Z\s'’áéíóúàèìòùäëïöüñçÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑÇ.]/g,
        ""
      );
    }
  }

  // Funció auxiliar per filtrar en temps real localitzacions (XSS prevention)
  function handleLocationInput(e) {
    const value = e.target.value;
    if (!allowedLocationCharsRegex.test(value)) {
      e.target.value = value.replace(/[<>&"'`]/g, "").trim();
    }
  }

  // Prevé entrades invàlides en keypress noms.
  function handleKeypress(e) {
    if (
      e.key === "Enter" ||
      e.key === "Tab" ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.key.length > 1
    ) {
      return;
    }
    if (!allowedCharsRegex.test(e.key)) {
      e.preventDefault();
    }
  }

  // Prevé keypress invàlides en localitzacions.
  function handleLocationKeypress(e) {
    if (
      e.key === "Enter" ||
      e.key === "Tab" ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.key.length > 1
    ) {
      return;
    }
    if (!allowedLocationCharsRegex.test(e.key)) {
      e.preventDefault();
    }
  }

  // Aplica als inputs de noms (conductor i ajudant).
  const nameInputs = [
    document.getElementById(DOM_IDS.PERSON1_INPUT),
    document.getElementById(DOM_IDS.PERSON2_INPUT),
  ].filter(Boolean);

  nameInputs.forEach((input) => {
    input.addEventListener("input", handleNameInput);
    input.addEventListener("keypress", handleKeypress);
  });

  // Aplica als inputs de localitzacions (orígens i destinacions).
  const locationInputs = document.querySelectorAll(
    ".service .origin, .service .destination"
  );
  locationInputs.forEach((input) => {
    input.addEventListener("input", handleLocationInput);
    input.addEventListener("keypress", handleLocationKeypress);
  });

  // Aplica restricció de longitud màxima al camp vehicle
  const vehicleInput = document.getElementById(DOM_IDS.VEHICLE_INPUT);
  if (vehicleInput) {
    vehicleInput.addEventListener("input", (e) => {
      if (e.target.value.length > VALIDATION_RULES.VEHICLE_MAX_LENGTH) {
        e.target.value = e.target.value.slice(
          0,
          VALIDATION_RULES.VEHICLE_MAX_LENGTH
        );
      }
    });
  }
}
