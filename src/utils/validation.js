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
  SERVICE_NUMBER_PREFIX: "service-number-", // Prefix per als IDs dels números de servei
};
const CSS_CLASSES = {
  INPUT_ERROR: "input-error",
};
const VALIDATION_RULES = {
  SERVICE_NUMBER_LENGTH: 9, // Longitud requerida per al número de servei
};

// --- Funcions Internes d'Ajuda ---

/**
 * Marca un element amb la classe d'error.
 * @param {Element} element - L'element del DOM a marcar.
 */
function _markError(element) {
  element?.classList.add(CSS_CLASSES.INPUT_ERROR);
}

/**
 * Elimina la classe d'error d'un element.
 * @param {Element} element - L'element del DOM a netejar.
 */
function _clearError(element) {
  element?.classList.remove(CSS_CLASSES.INPUT_ERROR);
}

/**
 * Formata una llista d'índexs de servei (ex: [1, 3]) en un string llegible ("S1 i S3").
 * @param {number[]} indexes - Array d'índexs (base 1).
 * @returns {string} String formatat.
 */
function _formatServiceList(indexes) {
  if (!indexes || indexes.length === 0) return "";
  const sList = indexes.map((i) => `S${i}`);
  if (sList.length === 1) return sList[0];
  if (sList.length === 2) return sList.join(" y ");
  // Per a 3 o més: "S1, S2 y S3"
  return `${sList.slice(0, -1).join(", ")} y ${sList[sList.length - 1]}`;
}

/**
 * Valida un únic input de número de servei.
 * @param {HTMLInputElement} inputElement - L'element input a validar.
 * @param {number} serviceIndex - L'índex del servei (base 1).
 * @param {boolean} isRequired - Indica si aquest camp és obligatori.
 * @param {object} errorMap - Objecte on registrar els tipus d'error trobats.
 * @returns {boolean} True si és vàlid (o opcional i buit), False si hi ha error.
 */
function _validateSingleServiceNumber(
  inputElement,
  serviceIndex,
  isRequired,
  errorMap
) {
  if (!inputElement) return true; // Si no existeix l'element, no podem validar

  _clearError(inputElement); // Neteja error previ
  const value = inputElement.value.trim();

  if (!value) {
    // Camp buit
    if (isRequired) {
      _markError(inputElement);
      errorMap.emptyRequiredS1 = true; // Marca error específic S1 buit
      return false;
    }
    return true; // Si és opcional i buit, és vàlid
  }

  // Comprova si només són dígits
  if (!/^\d+$/.test(value)) {
    _markError(inputElement);
    errorMap.nonNumeric.push(serviceIndex);
    return false; // Error no numèric
  }

  // Comprova longitud (només si és numèric)
  if (value.length !== VALIDATION_RULES.SERVICE_NUMBER_LENGTH) {
    _markError(inputElement);
    errorMap.digitLength.push(serviceIndex); // Canviat nom de la clau per claredat
    return false; // Error de longitud
  }

  return true; // Vàlid
}

/** Converteix "HH:MM" a minuts totals des de mitjanit. */
function _timeToMinutes(timeString) {
  if (!timeString || !/^\d{2}:\d{2}$/.test(timeString)) return NaN; // Retorna NaN si el format és incorrecte
  const [hours, minutes] = timeString.split(":").map(Number);
  return hours * 60 + minutes;
}

// --- Funcions de Validació Exportades ---

/**
 * Valida els camps obligatoris de la pestanya "Datos".
 * @returns {boolean} True si la pestanya és vàlida, False altrament.
 * @export
 */
export function validateDadesTab() {
  let isValid = true;
  const dateInput = document.getElementById(DOM_IDS.DATE_INPUT);
  const dietTypeSelect = document.getElementById(DOM_IDS.DIET_TYPE_SELECT);
  // Podrien afegir-se aquí les validacions per vehicle, person1, person2 si fossin obligatoris sempre

  _clearError(dateInput);
  _clearError(dietTypeSelect);

  if (!dateInput?.value.trim()) {
    _markError(dateInput);
    isValid = false;
  }
  if (!dietTypeSelect?.value.trim()) {
    _markError(dietTypeSelect);
    isValid = false;
  }
  // Validació conductor/ajudant (exemple, si fossin obligatoris)
  // const p1Input = document.getElementById('person1');
  // const p2Input = document.getElementById('person2');
  // _clearError(p1Input?.closest('.input-with-icon')); // Neteja el grup
  // _clearError(p2Input?.closest('.input-with-icon'));
  // if (!p1Input?.value.trim()) { _markError(p1Input?.closest('.input-with-icon')); isValid = false; }
  // if (!p2Input?.value.trim()) { _markError(p2Input?.closest('.input-with-icon')); isValid = false; }

  return isValid;
}

/**
 * Valida els camps de número de servei a la pestanya "Servicios".
 * Comprova que S1 existeixi i que tots els números de servei introduïts
 * siguin numèrics i tinguin la longitud correcta.
 * @returns {boolean} True si la pestanya és vàlida, False altrament.
 * @export
 */
export function validateServeisTab() {
  let overallValid = true;
  const errorMap = {
    emptyRequiredS1: false, // S1 obligatori és buit?
    nonNumeric: [], // Índexs de serveis no numèrics
    digitLength: [], // Índexs de serveis amb longitud incorrecta
  };

  // Valida S1 (obligatori)
  const service1Input = document.getElementById(
    `${DOM_IDS.SERVICE_NUMBER_PREFIX}1`
  );
  if (!service1Input) {
    console.error("Validation: No s'ha trobat l'input per al servei S1.");
    showToast("Error intern: No es pot validar el servei S1.", "error");
    return false; // Error crític si falta S1
  }
  overallValid =
    _validateSingleServiceNumber(service1Input, 1, true, errorMap) &&
    overallValid;

  // Valida S2, S3, S4 (opcionals pel que fa a estar buits, però si tenen valor han de ser correctes)
  for (let i = 2; i <= 4; i++) {
    const serviceInputElement = document.getElementById(
      `${DOM_IDS.SERVICE_NUMBER_PREFIX}${i}`
    );
    // Només valida si l'element existeix
    if (serviceInputElement) {
      overallValid =
        _validateSingleServiceNumber(serviceInputElement, i, false, errorMap) &&
        overallValid;
    }
  }

  // Si tot és vàlid fins ara, no mostrem errors
  if (overallValid) return true;

  // Construeix i mostra missatges d'error agregats
  const errorMessages = [];
  if (errorMap.emptyRequiredS1) {
    // No afegim missatge aquí, ja es marca el camp. El toast general avisarà.
  }
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
  } else if (errorMap.emptyRequiredS1) {
    // Si l'únic error és S1 buit, podem mostrar un toast genèric o confiar en la marca del camp
    // showToast("El número del primer servicio (S1) es obligatorio.", "error");
  }

  return false; // Indica que hi ha hagut errors
}

/**
 * Valida la coherència dels horaris (Origen <= Destí <= Final)
 * en tots els serveis que tinguin les tres hores informades.
 * Mostra un toast si troba una incoherència.
 * @returns {boolean} True si tots els horaris són coherents o no estan complets, False si hi ha incoherència.
 * @export
 */
export function validateServiceTimesConsistency() {
  const allServiceElements = document.querySelectorAll(".service"); // Selector base del panell de servei
  let isInconsistentFound = false;

  for (let i = 0; i < allServiceElements.length; i++) {
    const serviceElement = allServiceElements[i];
    const originTimeInput = serviceElement.querySelector(".origin-time");
    const destinationTimeInput =
      serviceElement.querySelector(".destination-time");
    const endTimeInput = serviceElement.querySelector(".end-time");

    // Neteja errors previs d'aquests camps
    _clearError(originTimeInput);
    _clearError(destinationTimeInput);
    _clearError(endTimeInput);

    const originTime = originTimeInput?.value;
    const destinationTime = destinationTimeInput?.value;
    const endTime = endTimeInput?.value;

    // Només valida si les TRES hores estan presents
    if (originTime && destinationTime && endTime) {
      const originMinutes = _timeToMinutes(originTime);
      const destinationMinutes = _timeToMinutes(destinationTime);
      const endMinutes = _timeToMinutes(endTime);

      // Comprova si alguna conversió ha fallat (NaN)
      if (
        isNaN(originMinutes) ||
        isNaN(destinationMinutes) ||
        isNaN(endMinutes)
      ) {
        console.warn(`Servei ${i + 1}: Format d'hora invàlid.`);
        // Podríem marcar error aquí o deixar-ho per a una validació de format
        continue; // Salta a la següent iteració
      }

      // Comprova coherència
      if (
        originMinutes > destinationMinutes ||
        destinationMinutes > endMinutes
      ) {
        console.warn(
          `Servei ${
            i + 1
          }: Hores incoherents. Origen: ${originTime}, Destí: ${destinationTime}, Final: ${endTime}`
        );
        _markError(originTimeInput);
        _markError(destinationTimeInput);
        _markError(endTimeInput);
        isInconsistentFound = true;
        // No parem aquí, marquem tots els serveis incoherents
      }
    }
  }

  if (isInconsistentFound) {
    showToast(
      "Revisa los horarios. La hora de origen debe ser anterior o igual a la de destino, y esta anterior o igual a la final.",
      "error"
    );
    return false; // Hi ha incoherències
  }

  return true; // Tot coherent
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
