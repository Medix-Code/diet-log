// src/services/userService.js
/**
 * @module userService
 * @description Gestiona l'ID anònim de l'usuari amb persistència en localStorage.
 */

const USER_ID_KEY = "anonymousUserId";

/**
 * Obté o crea l'ID anònim de l'usuari.
 * @returns {string} L'ID únic.
 * @export
 */
export function getAnonymousUserId() {
  try {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
      userId = `user-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 11)}`;
      localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
  } catch (err) {
    // Si localStorage falla (ex.: privat mode), retorna ID temporal
    return `temp-user-${Date.now()}`;
  }
}
