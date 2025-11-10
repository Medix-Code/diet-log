/**
 * Gestió de preferències d'usuari amb IndexedDB (amb fallback a localStorage)
 *
 * Migracio progressiva de localStorage → IndexedDB per:
 * - Major capacitat d'emmagatzematge
 * - Millor seguretat (no accessible via XSS)
 * - Operacions asíncrones (no bloquegen UI)
 */

const DB_NAME = "user-preferences";
const DB_VERSION = 1;
const STORE_NAME = "preferences";

let dbInstance = null;

/**
 * Obre la base de dades de preferències
 */
async function openPreferencesDB() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(new Error(`Error obrint DB de preferències: ${event.target.error}`));
    };
  });
}

/**
 * Guarda una preferència a IndexedDB amb fallback a localStorage
 * @param {string} key - Clau de la preferència
 * @param {any} value - Valor a guardar
 */
export async function savePreference(key, value) {
  try {
    const db = await openPreferencesDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // També guardar a localStorage per compatibilitat amb codi legacy
    try {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    } catch (lsError) {
      console.warn(`[Preferences] No s'ha pogut guardar a localStorage (quota?):`, lsError);
    }
  } catch (error) {
    // Fallback a localStorage si IndexedDB falla
    console.warn(`[Preferences] IndexedDB error, usant localStorage:`, error);
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  }
}

/**
 * Recupera una preferència d'IndexedDB amb fallback a localStorage
 * @param {string} key - Clau de la preferència
 * @param {any} defaultValue - Valor per defecte si no existeix
 * @returns {Promise<any>} Valor de la preferència
 */
export async function getPreference(key, defaultValue = null) {
  try {
    const db = await openPreferencesDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);

    const value = await new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Si trobem valor a IndexedDB, retornar-lo
    if (value !== undefined) {
      return value;
    }

    // Si no hi és a IndexedDB, intentar migrar des de localStorage
    const legacyValue = localStorage.getItem(key);
    if (legacyValue !== null) {
      console.log(`[Preferences] Migrant ${key} des de localStorage a IndexedDB`);

      // Intentar parsejar si és JSON
      let parsedValue;
      try {
        parsedValue = JSON.parse(legacyValue);
      } catch {
        parsedValue = legacyValue; // Si no és JSON, usar com a string
      }

      // Guardar a IndexedDB per futures lectures
      await savePreference(key, parsedValue);
      return parsedValue;
    }

    return defaultValue;
  } catch (error) {
    // Fallback a localStorage si IndexedDB falla
    console.warn(`[Preferences] IndexedDB error, usant localStorage:`, error);
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
}

/**
 * Elimina una preferència
 * @param {string} key - Clau de la preferència
 */
export async function removePreference(key) {
  try {
    const db = await openPreferencesDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // També eliminar de localStorage
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[Preferences] IndexedDB error, usant localStorage:`, error);
    localStorage.removeItem(key);
  }
}

/**
 * Neteja totes les preferències
 */
export async function clearAllPreferences() {
  try {
    const db = await openPreferencesDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    localStorage.clear();
  } catch (error) {
    console.warn(`[Preferences] IndexedDB error, usant localStorage:`, error);
    localStorage.clear();
  }
}
