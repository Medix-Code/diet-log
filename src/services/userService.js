// src/services/userService.js

const USER_ID_KEY = "anonymousUserId";

/**
 * Obté l'ID anònim de l'usuari des del localStorage.
 * Si no existeix, en crea un de nou, el guarda i el retorna.
 * @returns {string} L'identificador únic i anònim de l'usuari.
 */
export function getAnonymousUserId() {
  let userId = localStorage.getItem(USER_ID_KEY);

  if (!userId) {
    // Si no hi ha ID, en generem un de nou.
    // Combinem la data actual amb una cadena aleatòria per assegurar que sigui únic.
    userId = `user-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    // El guardem a localStorage per a futures visites
    localStorage.setItem(USER_ID_KEY, userId);

    console.log("Nou ID d'usuari anònim creat:", userId);
  }

  return userId;
}
