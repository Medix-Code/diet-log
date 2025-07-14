/**
 * @file validation.js
 * @description Lògica per validar diferents seccions del formulari amb robustesa.
 * @module formValidation
 */

import { showToast } from "../ui/toast.js";

// --- Constants ---
const DOM_IDS = {
  DATE_INPUT: "date",
  DIET_TYPE_SELECT: "diet-type",
  SERVICE_NUMBER_PREFIX: "service-number-",
  VEHICLE_INPUT: "vehicle-number",
  PERSON1_INPUT: "person1",
  PERSON2_INPUT: "person2",
};
const CSS_CLASSES = {
  INPUT_ERROR: "input-error",
};
const VALIDATION_RULES = {
  SERVICE_NUMBER_LENGTH: 9,
  VEHICLE_MAX_LENGTH: 6,
  PERSON_NAME_MAX_LENGTH: 28,
  LOCATION_MAX_LENGTH: 35,
  PERSON_NAME_ALLOWED_CHARS: /^[a-zA-Z\s'’áéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜ]+$/u,
};

const SELECTORS = {
  PERSON_INPUT_GROUP: ".input-with-icon",
};

// --- Funcions Internes d'Ajuda ---

/**
 * Marca un element com a error.
 * @param {HTMLElement} element
 */
function _markError(element) {
  element?.classList.add(CSS_CLASSES.INPUT_ERROR);
}

/**
 * Neteja la marca d'error d'un element.
 * @param {HTMLElement} element
 */
function _clearError(element) {
  element?.classList.remove(CSS_CLASSES.INPUT_ERROR);
}

/**
 * Formata una llista de serveis per missatges d'error.
 * @param {number[]} indexes
 * @returns {string}
 */
function _formatServiceList(indexes) {
  if (!indexes || indexes.length === 0) return "";
  const sList = indexes.map((i) => `S${i}`);
  if (sList.length === 1) return sList[0];
  if (sList.length === 2) return sList.join(" y ");
  return `${sList.slice(0, -1).join(", ")} y ${sList[sList.length - 1]}`;
}

/**
 * Afegeix listener per netejar error en input (una vegada).
 * @param {HTMLElement} element
 */
function _addInstantErrorClearListener(element) {
  if (!element || element.dataset.errorListenerAttached) return;
  element.addEventListener("input", () => _clearError(element), { once: true });
  element.dataset.errorListenerAttached = "true";
}

/**
 * Valida un input de número de servei.
 * @param {HTMLInputElement} inputElement
 * @param {number} serviceIndex
 * @param {boolean} isRequired
 * @param {Object} errorMap
 * @returns {boolean}
 */
function _validateSingleServiceNumber(
  inputElement,
  serviceIndex,
  isRequired,
  errorMap
) {
  if (!inputElement) return true;
  _clearError(inputElement);
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
    _markError(inputElement);
    _addInstantErrorClearListener(inputElement);
    return false;
  }
  return true;
}

/**
 * Converteix temps HH:MM a minuts.
 * @param {string} timeString
 * @returns {number} Minuts o NaN si invàlid.
 */
function _timeToMinutes(timeString) {
  if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) return NaN;
  const [hours, minutes] = timeString.split(":").map(Number);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN; // Validació extra
  return hours * 60 + minutes;
}

// --- Funcions de Validació Exportades ---

/**
 * Valida la pestanya de dades.
 * @returns {boolean}
 * @export
 */
export function validateDadesTab() {
  let isValid = true;
  const fieldsToValidate = [
    document.getElementById(DOM_IDS.DATE_INPUT),
    document.getElementById(DOM_IDS.DIET_TYPE_SELECT),
  ].filter(Boolean); // Filtra nuls

  fieldsToValidate.forEach((field) => {
    _clearError(field);
    if (!field.value.trim()) {
      _markError(field);
      _addInstantErrorClearListener(field);
      isValid = false;
    }
  });

  return isValid;
}

/**
 * Valida la pestanya de serveis.
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
    console.error("Validation: No s'ha trobat l'input per al servei S1.");
    return false;
  }
  overallValid =
    _validateSingleServiceNumber(service1Input, 1, true, errorMap) &&
    overallValid;

  for (let i = 2; i <= 4; i++) {
    const serviceInputElement = document.getElementById(
      `${DOM_IDS.SERVICE_NUMBER_PREFIX}${i}`
    );
    if (serviceInputElement) {
      overallValid =
        _validateSingleServiceNumber(serviceInputElement, i, false, errorMap) &&
        overallValid;
    }
  }

  if (overallValid) return true;

  const errorMessages = [];
  if (errorMap.nonNumeric.length > 0) {
    errorMessages.push(
      `El número de servicio ${_formatServiceList(
        errorMap.nonNumeric
      )} debe contener solo dígitos.`
    );
  }
  if (errorMap.digitLength.length > 0) {
    errorMessages.push(
      `El número de servicio ${_formatServiceList(
        errorMap.digitLength
      )} debe tener ${VALIDATION_RULES.SERVICE_NUMBER_LENGTH} dígitos.`
    );
  }

  if (errorMessages.length > 0) {
    showToast(errorMessages.join("\n"), "error");
  }

  return false;
}

/**
 * Valida consistència d'horaris en serveis.
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
 * Validació per generar PDF.
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
 * Neteja i saneja una cadena de text.
 * 1. Elimina espais en blanc a l'inici i al final.
 * 2. Converteix caràcters HTML perillosos per evitar atacs XSS.
 * @param {string} input - La cadena de text a processar.
 * @returns {string} - La cadena de text neta i sanejada.
 */
export function sanitizeText(input) {
  if (typeof input !== "string") {
    return "";
  }

  const trimmedInput = input.trim();

  const temp = document.createElement("div");
  temp.textContent = trimmedInput;
  return temp.innerHTML;
}

/**
 * Valida si una cadena de text té el format d'hora HH:mm (24h).
 * Permet que la cadena estigui buida (considerat vàlid en aquest context).
 * @param {string} timeStr - La cadena de text a validar.
 * @returns {boolean} - True si el format és vàlid o la cadena és buida, false altrament.
 */
export function isValidTimeFormat(timeStr) {
  // Si la cadena és buida o nul·la, la considerem vàlida per no bloquejar camps opcionals.
  if (!timeStr) {
    return true;
  }
  // L'expressió regular per al format HH:mm
  const timeRegex = /^(?:2[0-3]|[01]?[0-9]):[0-5][0-9]$/;
  return timeRegex.test(timeStr);
}

/**
 * Valida els camps de la dotació (Vehicle, Conductor, Ajudant).
 * @returns {boolean} - True si és vàlid, false si hi ha errors.
 * @export
 */

export function validateDotacioTab() {
  const vehicleInput = document.getElementById(DOM_IDS.VEHICLE_INPUT);
  const conductorInput = document.getElementById(DOM_IDS.PERSON1_INPUT);
  const ajudantInput = document.getElementById(DOM_IDS.PERSON2_INPUT);
  const conductorGroup = conductorInput?.closest(SELECTORS.PERSON_INPUT_GROUP);
  const ajudantGroup = ajudantInput?.closest(SELECTORS.PERSON_INPUT_GROUP);

  // Neteja errors previs
  _clearError(vehicleInput);
  _clearError(conductorGroup);
  _clearError(ajudantGroup);

  const vehicleValue = vehicleInput?.value.trim() || "";
  const conductorValue = conductorInput?.value.trim() || "";
  const ajudantValue = ajudantInput?.value.trim() || "";

  let isValid = true;
  const errorMessages = [];

  // 1. Validació del vehicle (es manté igual)
  if (!vehicleValue) {
    _markError(vehicleInput);
    errorMessages.push("El campo Vehículo es obligatorio.");
    isValid = false;
  } else if (vehicleValue.length > VALIDATION_RULES.VEHICLE_MAX_LENGTH) {
    _markError(vehicleInput);
    errorMessages.push(
      `El Vehículo no puede tener más de ${VALIDATION_RULES.VEHICLE_MAX_LENGTH} caracteres.`
    );
    isValid = false;
  }

  // 2. Validació del personal (MODIFICADA)

  // Comprovació de caràcters permesos per al conductor
  if (
    conductorValue &&
    !VALIDATION_RULES.PERSON_NAME_ALLOWED_CHARS.test(conductorValue)
  ) {
    _markError(conductorGroup);
    errorMessages.push(
      "El nombre del Conductor solo puede contener letras, espacios, apóstrofos y acentos."
    );
    isValid = false;
  } else if (conductorValue.length > VALIDATION_RULES.PERSON_NAME_MAX_LENGTH) {
    _markError(conductorGroup);
    errorMessages.push(
      `El nombre del Conductor no puede superar los ${VALIDATION_RULES.PERSON_NAME_MAX_LENGTH} caracteres.`
    );
    isValid = false;
  }

  // Comprovació de caràcters permesos per a l'ajudant
  if (
    ajudantValue &&
    !VALIDATION_RULES.PERSON_NAME_ALLOWED_CHARS.test(ajudantValue)
  ) {
    _markError(ajudantGroup);
    errorMessages.push(
      "El nombre del Ayudante solo puede contener letras, espacios, apóstrofos y acentos."
    );
    isValid = false;
  } else if (ajudantValue.length > VALIDATION_RULES.PERSON_NAME_MAX_LENGTH) {
    _markError(ajudantGroup);
    errorMessages.push(
      `El nombre del Ayudante no puede superar los ${VALIDATION_RULES.PERSON_NAME_MAX_LENGTH} caracteres.`
    );
    isValid = false;
  }

  // Comprovació de si almenys un dels dos camps està ple
  if (!conductorValue && !ajudantValue) {
    _markError(conductorGroup);
    _markError(ajudantGroup);
    if (isValid) {
      errorMessages.push("Debe indicar al menos un Conductor o Ayudante.");
    }
    isValid = false;
  }

  // 3. Mostra missatges si hi ha errors
  if (!isValid) {
    _addInstantErrorClearListener(vehicleInput);
    _addInstantErrorClearListener(conductorInput);
    _addInstantErrorClearListener(ajudantInput);
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
    _clearError(input);
    const value = input.value.trim();
    if (value && value.length > VALIDATION_RULES.LOCATION_MAX_LENGTH) {
      const serviceContainer = input.closest(".service");
      const serviceNum = serviceContainer.className.match(/service-(\d)/)[1];
      const fieldType = input.classList.contains("origin")
        ? "Origen"
        : "Destino";

      errorMessages.push(
        `El campo ${fieldType} del Servicio ${serviceNum} no puede superar los ${VALIDATION_RULES.LOCATION_MAX_LENGTH} caracteres.`
      );
      _markError(input);
      _addInstantErrorClearListener(input);
      isValid = false;
    }
  });

  if (!isValid) {
    showToast(errorMessages.join("\n"), "error");
  }

  return isValid;
}

/**
 * Afegeix listeners als camps de nom per eliminar caràcters no permesos
 * a mesura que l'usuari escriu.
 * @export
 */
export function sanitizeNameInputs() {
  const allowedCharsRegex = /[^a-zA-Z\s'’áéíóúàèìòùäëïöüÁÉÍÓÚÀÈÌÒÙÄËÏÖÜ]/g;

  const handleInput = (event) => {
    const input = event.target;
    if (input.value.match(allowedCharsRegex)) {
      input.value = input.value.replace(allowedCharsRegex, "");
    }
  };

  const person1Input = document.getElementById("person1");
  const person2Input = document.getElementById("person2");

  person1Input?.addEventListener("input", handleInput);
  person2Input?.addEventListener("input", handleInput);
}
