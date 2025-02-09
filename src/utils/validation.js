/**
 * Funcions de validació
 */

import { validateServiceNumber } from "../services/servicesPanelManager.js";

/**
 * Validació de la pestanya "Datos"
 */
export function validateDadesTab() {
  let valid = true;
  const dateInput = document.getElementById("date");
  const dietTypeSelect = document.getElementById("diet-type");

  // Elimina classe d'error prèvia
  [dateInput, dietTypeSelect].forEach((el) =>
    el.classList.remove("input-error")
  );

  function markError(el) {
    el.classList.add("input-error");
    valid = false;
  }

  // Camps obligatoris a la pestanya "Datos"
  if (!dateInput.value.trim()) markError(dateInput);
  if (!dietTypeSelect.value.trim()) markError(dietTypeSelect);

  return valid; // true si cap error, false si hi ha algun error
}

/**
 * Validació de la pestanya "Servicios"
 * (aquí, només mirem el service1Number del primer servei obligatori)
 */
export function validateServeisTab() {
  let valid = true;
  const service1Number = document.getElementById("service-number-1");
  service1Number.classList.remove("input-error");

  function markError(el) {
    el.classList.add("input-error");
    valid = false;
  }

  const s1val = service1Number.value.trim();
  if (!s1val) {
    markError(service1Number);
  } else if (s1val.length < 9) {
    markError(service1Number);
  } else if (!validateServiceNumber(s1val)) {
    markError(service1Number);
  }

  return valid; // true o false
}

/**
 * Funció que agrupa la validació mínima per guardar (si vols)
 */
export function validateMinFieldsForSave() {
  const dadesOK = validateDadesTab();
  const serveisOK = validateServeisTab();

  // Retorna true només si ambdós tab OK
  return dadesOK && serveisOK;
}

/**
 * Pel PDF, podria fer el mateix
 */
export function validateForPdf() {
  return validateMinFieldsForSave();
}

/**
 * Valida que els temps d'origen/destí/final siguin coherents
 */
export function validateServiceTimesForAll() {
  const allServices = document.querySelectorAll(".service");
  for (let service of allServices) {
    const originTime = service.querySelector(".origin-time").value;
    const destinationTime = service.querySelector(".destination-time").value;
    const endTime = service.querySelector(".end-time").value;

    if (originTime && destinationTime && endTime) {
      const originMinutes = timeToMinutes(originTime);
      const destinationMinutes = timeToMinutes(destinationTime);
      const endMinutes = timeToMinutes(endTime);

      if (originMinutes > destinationMinutes) return false;
      if (destinationMinutes > endMinutes) return false;
      if (originMinutes > endMinutes) return false;
    }
  }
  return true;
}

function timeToMinutes(hhmm) {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}
