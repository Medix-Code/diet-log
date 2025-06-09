/**
 * @file Diet.js
 * @description Defineix l'estructura de dades per a un objecte Dieta.
 * @module Diet
 */

/**
 * Representa una dieta amb totes les seves dades associades.
 * @class Diet
 */
export class Diet {
  /**
   * Crea una instància de Diet.
   * @param {object} options - Objecte amb les propietats de la dieta.
   * @param {string} [options.id=''] - ID únic de la dieta (ex: número servei 1).
   * @param {string} [options.date=''] - Data de la dieta en format YYYY-MM-DD.
   * @param {('lunch'|'dinner'|string)} [options.dietType=''] - Tipus de dieta ('lunch', 'dinner', o altre).
   * @param {string} [options.vehicleNumber=''] - Número del vehicle.
   * @param {string} [options.person1=''] - Nom del conductor.
   * @param {string} [options.person2=''] - Nom de l'ajudant.
   * @param {string} [options.signatureConductor=''] - Signatura del conductor (DataURL base64).
   * @param {string} [options.signatureAjudant=''] - Signatura de l'ajudant (DataURL base64).
   * @param {Array<object>} [options.services=[]] - Array d'objectes de servei.
   * @param {string} [options.empresa=''] - Nom de l'empresa.
   * @param {string} [options.timeStampDiet=new Date().toISOString()] - Timestamp ISO de quan es va desar/actualitzar.
   */
  constructor({
    id = "",
    date = "",
    dietType = "",
    vehicleNumber = "",
    person1 = "",
    person2 = "",
    signatureConductor = "",
    signatureAjudant = "",
    services = [], // Assegura que és un array per defecte
    empresa = "",
    timeStampDiet = new Date().toISOString(),
  } = {}) {
    // Afegeix valor per defecte per a l'objecte options
    /** @property {string} id - ID únic de la dieta. */
    this.id = String(id); // Assegura que és string

    /** @property {string} date - Data (YYYY-MM-DD). */
    this.date = String(date);

    /** @property {string} dietType - Tipus ('lunch', 'dinner', etc.). */
    this.dietType = String(dietType);

    /** @property {string} vehicleNumber - Número del vehicle. */
    this.vehicleNumber = String(vehicleNumber);

    /** @property {string} person1 - Nom del conductor. */
    this.person1 = String(person1);

    /** @property {string} person2 - Nom de l'ajudant. */
    this.person2 = String(person2);

    /** @property {string} signatureConductor - Signatura conductor (DataURL). */
    this.signatureConductor = String(signatureConductor);

    /** @property {string} signatureAjudant - Signatura ajudant (DataURL). */
    this.signatureAjudant = String(signatureAjudant);

    /** @property {Array<object>} services - Array d'objectes de servei. */
    this.services = Array.isArray(services) ? services : []; // Assegura que és array

    /** @property {string} empresa - Nom de l'empresa. */
    this.empresa = String(empresa);

    /** @property {string} timeStampDiet - Timestamp ISO. */
    this.timeStampDiet = String(timeStampDiet);
  }
}
