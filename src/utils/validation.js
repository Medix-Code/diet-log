/**
 * @file validation.js
 * @description Lògica per validar diferents seccions del formulari.
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

function _markError(element) {
  element?.classList.add(CSS_CLASSES.INPUT_ERROR);
}

function _clearError(element) {
  element?.classList.remove(CSS_CLASSES.INPUT_ERROR);
}

function _formatServiceList(indexes) {
  if (!indexes || indexes.length === 0) return "";
  const sList = indexes.map((i) => `S${i}`);
  if (sList.length === 1) return sList[0];
  if (sList.length === 2) return sList.join(" y ");
  return `${sList.slice(0, -1).join(", ")} y ${sList[sList.length - 1]}`;
}

// >>> NOVA FUNCIÓ per a la neteja instantània d'errors <<<
/**
 * Afegeix un listener a un input per netejar la seva classe d'error a l'escriure.
 * El listener s'executa només un cop.
 * @param {HTMLElement} element L'element de l'input.
 */
function _addInstantErrorClearListener(element) {
  // Si no hi ha element o ja li hem posat el listener, no fem res
  if (!element || element.dataset.errorListenerAttached) return;

  element.addEventListener(
    "input",
    () => {
      // A la que l'usuari escriu, netegem l'error visualment.
      _clearError(element);
    },
    { once: true }
  ); // { once: true } fa que el listener s'esborri sol després d'executar-se.

  // Marquem l'element per no afegir el listener múltiples vegades
  element.dataset.errorListenerAttached = "true";
}

/**
 * Valida un únic input de número de servei.
 * @param {HTMLInputElement} inputElement - L'element input a validar.
 * @param {number} serviceIndex - L'índex del servei (base 1).
 * @param {boolean} isRequired - Indica si aquest camp és obligatori.
 * @param {object} errorMap - Objecte on registrar els tipus d'error trobats.
 * @returns {boolean} True si és vàlid, False si hi ha error.
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

  // >>> LÒGICA MODIFICADA <<<
  // Si hem detectat qualsevol error, marquem el camp i afegim el listener.
  if (hasError) {
    _markError(inputElement);
    _addInstantErrorClearListener(inputElement); // Afegim el listener per a la neteja ràpida
    return false;
  }

  return true;
}

function _timeToMinutes(timeString) {
  if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) return NaN;
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

// --- Funcions de Validació Exportades ---

export function validateDadesTab() {
  let isValid = true;
  const fieldsToValidate = [
    document.getElementById(DOM_IDS.DATE_INPUT),
    document.getElementById(DOM_IDS.DIET_TYPE_SELECT),
  ];

  fieldsToValidate.forEach((field) => {
    if (field) {
      _clearError(field);
      if (!field.value.trim()) {
        _markError(field);
        _addInstantErrorClearListener(field); // Afegim també el listener als camps de dades
        isValid = false;
      }
    }
  });

  return isValid;
}

export function validateServeisTab() {
  let overallValid = true;
  const errorMap = {
    emptyRequiredS1: false,
    nonNumeric: [],
    digitLength: [],
  };

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
    const serviceList = _formatServiceList(errorMap.nonNumeric);
    errorMessages.push(
      `El número de servicio ${serviceList} debe contener solo dígitos.`
    );
  }
  if (errorMap.digitLength.length > 0) {
    const serviceList = _formatServiceList(errorMap.digitLength);
    errorMessages.push(
      `El número de servicio ${serviceList} debe tener ${VALIDATION_RULES.SERVICE_NUMBER_LENGTH} dígitos.`
    );
  }

  if (errorMessages.length > 0) {
    showToast(errorMessages.join("\n"), "error");
  }

  return false;
}

export function validateServiceTimesConsistency() {
  let isInconsistentFound = false;
  const allServiceElements = document.querySelectorAll(".service");

  allServiceElements.forEach((serviceElement, i) => {
    const timeInputs = {
      origin: serviceElement.querySelector(".origin-time"),
      destination: serviceElement.querySelector(".destination-time"),
      end: serviceElement.querySelector(".end-time"),
    };

    // Neteja errors previs
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
        return; // Salta a la següent iteració del forEach
      }

      if (
        originMinutes > destinationMinutes ||
        destinationMinutes > endMinutes
      ) {
        console.warn(`Servei ${i + 1}: Hores incoherents.`);
        Object.values(timeInputs).forEach((input) => {
          _markError(input);
          _addInstantErrorClearListener(input); // Afegim neteja ràpida també aquí
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

// --- Funcions de Validació Compostes (Opcionals) ---

/**
 * Validació mínima suggerida abans de desar.
 * Comprova dades generals i números de servei.
 * @returns {boolean} True si la validació mínima passa.
 * @export
 */
export function validateMinFieldsForSave() {
  const dadesOk = validateDadesTab();
  const serveisNumOk = validateServeisTab();
  // Podríem afegir validateServiceTimesConsistency() aquí si és un requisit per desar
  // const timesOk = validateServiceTimesConsistency();
  // return dadesOk && serveisNumOk && timesOk;
  return dadesOk && serveisNumOk;
}

/**
 * Validació suggerida abans de generar el PDF.
 * Pot ser igual que la de desar o més estricta (p.ex., requerir hores coherents).
 * @returns {boolean} True si la validació per a PDF passa.
 * @export
 */
export function validateForPdf() {
  const dadesOk = validateDadesTab();
  const serveisNumOk = validateServeisTab();
  const timesOk = validateServiceTimesConsistency(); // Requerim hores coherents per al PDF
  return dadesOk && serveisNumOk && timesOk;
}
