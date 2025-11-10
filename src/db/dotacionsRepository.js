/**
 * Repository per gestionar dotacions amb IndexedDB (amb encriptació)
 * Substitució del localStorage per millorar rendiment i consistència
 * @module dotacionsRepository
 * @version 2.1.3
 */

import { logger } from "../utils/logger.js";
import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  INDEXES,
} from "./dbConfig.js";

const log = logger.withScope("DotacionsRepository");

// Constants
const DOTACIONS_STORE = STORE_NAMES.DOTACIONS;

let dbInstance = null;

/**
 * Obre la connexió a IndexedDB
 * @returns {Promise<IDBDatabase>}
 */
async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      const newVersion = event.newVersion;

      log.debug(`Actualitzant DB de v${oldVersion} a v${newVersion}`);

      // Crear object store de dietes si no existeix (v1)
      if (!db.objectStoreNames.contains(STORE_NAMES.DIETAS)) {
        const dietasStore = db.createObjectStore(STORE_NAMES.DIETAS, {
          keyPath: "id",
        });
        dietasStore.createIndex(INDEXES.DIET_DATE, "date", { unique: false });
        log.debug("Object store 'dietas' creat");
      }

      // Crear object store de dotacions (v2)
      if (!db.objectStoreNames.contains(DOTACIONS_STORE)) {
        const dotacionsStore = db.createObjectStore(DOTACIONS_STORE, {
          keyPath: "id",
        });
        dotacionsStore.createIndex(INDEXES.DOTACIONS_TIMESTAMP, "timestamp", {
          unique: false,
        });
        log.debug("Object store 'dotacions' creat");
      }

      // Assegurar paperera (v3)
      if (!db.objectStoreNames.contains(STORE_NAMES.DELETED_DIETS)) {
        const deletedStore = db.createObjectStore(
          STORE_NAMES.DELETED_DIETS,
          {
            keyPath: "id",
          }
        );
        deletedStore.createIndex(
          INDEXES.DELETED_DIETS_DELETED_AT,
          "deletedAt",
          { unique: false }
        );
        deletedStore.createIndex(
          INDEXES.DELETED_DIETS_TYPE,
          "dietType",
          { unique: false }
        );
        deletedStore.createIndex(
          INDEXES.DELETED_DIETS_DATE,
          "date",
          { unique: false }
        );
        log.debug("Object store 'deleted_diets' creat");
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      dbInstance.onclose = () => (dbInstance = null);
      dbInstance.onerror = () => (dbInstance = null);
      dbInstance.onversionchange = () => dbInstance.close();
      resolve(dbInstance);
    };

    request.onerror = (e) => {
      log.error("Error obrint base de dades:", e.target.error);
      reject(e.target.error);
    };

    request.onblocked = () => {
      const error = new Error("IndexedDB bloquejat per una altra pestanya");
      log.error(error.message);
      reject(error);
    };
  });
}

/**
 * Obté una transacció per l'object store de dotacions
 * @param {string} mode - "readonly" o "readwrite"
 * @returns {Promise<IDBTransaction>}
 */
async function getTransaction(mode = "readonly") {
  const db = dbInstance ?? (await openDatabase());
  return db.transaction(DOTACIONS_STORE, mode);
}

/**
 * Wrapper per convertir requests IDB en Promises
 * @param {IDBRequest} request
 * @param {string} errorMessage
 * @returns {Promise}
 */
function wrapRequest(request, errorMessage) {
  return new Promise((resolve, reject) => {
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => {
      log.error(`${errorMessage}:`, e.target.error);
      reject(new Error(`${errorMessage}: ${e.target.error}`));
    };
  });
}

/**
 * Espera que una transacció es completi
 * @param {IDBTransaction} tx
 * @returns {Promise}
 */
function waitTransaction(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Guarda dotacions encriptades a IndexedDB
 * @param {Object} encryptedData - Dades encriptades (format cryptoManager)
 * @returns {Promise<void>}
 */
export async function saveDotacions(encryptedData) {
  try {
    const tx = await getTransaction("readwrite");
    const store = tx.objectStore(DOTACIONS_STORE);

    const dotacionsRecord = {
      id: "current", // Sempre usem el mateix ID per sobrescriure
      data: encryptedData,
      timestamp: Date.now(),
      version: encryptedData.version || 1,
    };

    await wrapRequest(
      store.put(dotacionsRecord),
      "No s'han pogut guardar les dotacions"
    );
    await waitTransaction(tx);

    log.debug("✅ Dotacions guardades a IndexedDB");
  } catch (error) {
    log.error("Error guardant dotacions:", error);
    throw error;
  }
}

/**
 * Carrega dotacions encriptades des d'IndexedDB
 * @returns {Promise<Object|null>} Dades encriptades o null si no existeixen
 */
export async function loadDotacions() {
  try {
    const tx = await getTransaction("readonly");
    const store = tx.objectStore(DOTACIONS_STORE);

    const result = await wrapRequest(
      store.get("current"),
      "Error carregant dotacions"
    );

    if (!result) {
      log.debug("No hi ha dotacions guardades");
      return null;
    }

    log.debug("✅ Dotacions carregades des d'IndexedDB");
    return result.data;
  } catch (error) {
    log.error("Error carregant dotacions:", error);
    return null;
  }
}

/**
 * Elimina totes les dotacions
 * @returns {Promise<void>}
 */
export async function clearDotacions() {
  try {
    const tx = await getTransaction("readwrite");
    const store = tx.objectStore(DOTACIONS_STORE);

    await wrapRequest(store.delete("current"), "Error eliminant dotacions");
    await waitTransaction(tx);

    log.debug("✅ Dotacions eliminades");
  } catch (error) {
    log.error("Error eliminant dotacions:", error);
    throw error;
  }
}

/**
 * Migra dotacions des de localStorage a IndexedDB
 * @returns {Promise<boolean>} True si s'ha migrat, false si ja estava migrat o no hi havia dades
 */
export async function migrateDotacionsFromLocalStorage() {
  const LS_KEY = "dotacions_v2";
  const LS_ENCRYPTED_FLAG = "dotacions_encrypted";
  const MIGRATION_FLAG = "dotacions_migrated_to_indexeddb";

  try {
    // Comprovar si ja s'ha migrat
    if (localStorage.getItem(MIGRATION_FLAG) === "true") {
      log.debug("Dotacions ja migrades anteriorment");
      return false;
    }

    // Comprovar si hi ha dades a localStorage
    const lsData = localStorage.getItem(LS_KEY);
    if (!lsData) {
      log.debug("No hi ha dotacions a localStorage per migrar");
      localStorage.setItem(MIGRATION_FLAG, "true");
      return false;
    }

    log.debug("🔄 Iniciant migració de dotacions a IndexedDB...");

    // Carregar dades des de localStorage
    const encryptedData = JSON.parse(lsData);
    const isEncrypted = localStorage.getItem(LS_ENCRYPTED_FLAG) === "true";

    // Guardar a IndexedDB
    await saveDotacions(encryptedData);

    // Marcar com a migrat
    localStorage.setItem(MIGRATION_FLAG, "true");

    // OPCIONAL: Netejar localStorage després de migració exitosa
    // localStorage.removeItem(LS_KEY);
    // localStorage.removeItem(LS_ENCRYPTED_FLAG);
    // ↑ Comentat per mantenir backup temporal

    log.debug(
      `✅ Dotacions migrades a IndexedDB (${
        isEncrypted ? "encriptades" : "text pla"
      })`
    );
    return true;
  } catch (error) {
    log.error("❌ Error migrant dotacions:", error);
    // No marcar com a migrat si falla
    return false;
  }
}

/**
 * Tanca la connexió a la base de dades
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    log.debug("Connexió a DB tancada");
  }
}

export default {
  saveDotacions,
  loadDotacions,
  clearDotacions,
  migrateDotacionsFromLocalStorage,
  closeDatabase,
};
