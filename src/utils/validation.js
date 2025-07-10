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
};
const CSS_CLASSES = {
  INPUT_ERROR: "input-error",
};
const VALIDATION_RULES = {
  SERVICE_NUMBER_LENGTH: 9,
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
export function validateServiceTimesConsistency() {
  let isInconsistentFound = false;
  const allServiceElements = document.querySelectorAll(".service");

  allServiceElements.forEach((serviceElement, i) => {
    const timeInputs = {
      origin: serviceElement.querySelector(".origin-time"),
      destination: serviceElement.querySelector(".destination-time"),
      end: serviceElement.querySelector(".end-time"),
    };

    Object.values(timeInputs).forEach((input) => _clearError(input));

    const originTime = timeInputs.origin?.value;
    const destinationTime = timeInputs.destination?.value;
    const endTime = timeInputs.end?.value;

    if (originTime && destinationTime && endTime) {
      const originMinutes = _timeToMinutes(originTime);
      const destinationMinutes = _timeToMinutes(destinationTime);
      const endMinutes = _timeToMinutes(endTime);

      if (
        isNaN(originMinutes) ||
        isNaN(destinationMinutes) ||
        isNaN(endMinutes)
      ) {
        console.warn(`Servei ${i + 1}: Format d'hora invàlid.`);
        return;
      }

      if (
        originMinutes > destinationMinutes ||
        destinationMinutes > endMinutes
      ) {
        Object.values(timeInputs).forEach((input) => {
          _markError(input);
          _addInstantErrorClearListener(input);
        });
        isInconsistentFound = true;
      }
    }
  });

  if (isInconsistentFound) {
    showToast(
      "Revisa los horarios. El orden debe ser Origen <= Destino <= Final.",
      "error"
    );
    return false;
  }
  return true;
}

/**
 * Validació mínima per guardar.
 * @returns {boolean}
 * @export
 */
export function validateMinFieldsForSave() {
  return validateDadesTab() && validateServeisTab();
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
    validateServiceTimesConsistency()
  );
}
