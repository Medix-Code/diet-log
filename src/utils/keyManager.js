/**
 * KeyManager - Gestió transparent de claus mestres d'encriptació
 *
 * Funcionalitats:
 * - Generació automàtica de clau mestra (primera vegada)
 * - Emmagatzematge segur a IndexedDB
 * - Device fingerprinting per protecció extra
 * - Recuperació automàtica de claus
 * - Sistema de recovery phrase (opcional)
 *
 * @module keyManager
 * @version 1.0.0 (2025)
 */

import { logger } from "./logger.js";

const log = logger.withScope("KeyManager");

// Constants
const KEY_STORE_NAME = "encryption-keys";
const KEY_STORE_VERSION = 1;
const MASTER_KEY_ID = "master-key-v1";
const WRAPPED_KEY_ID = "wrapped-master-key";
const DEVICE_SALT_ID = "device-salt";

// Configuració de la clau mestra
const MASTER_KEY_CONFIG = {
  name: "AES-GCM",
  length: 256,
};

// Configuració per wrapping (protegir la clau mestra)
const WRAPPING_CONFIG = {
  name: "AES-KW", // AES Key Wrap
  length: 256,
};

/**
 * Obre la base de dades de claus
 * @returns {Promise<IDBDatabase>} Base de dades
 */
async function openKeyDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(KEY_STORE_NAME, KEY_STORE_VERSION);

    request.onerror = () => {
      log.error("Error obrint base de dades de claus");
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Crear object store si no existeix
      if (!db.objectStoreNames.contains("keys")) {
        db.createObjectStore("keys", { keyPath: "id" });
        log.debug("Object store de claus creat");
      }
    };
  });
}

/**
 * Guarda una clau a la base de dades
 * @param {string} id - ID de la clau
 * @param {any} value - Valor a guardar
 */
async function saveToKeyStore(id, value) {
  const db = await openKeyDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["keys"], "readwrite");
    const store = transaction.objectStore("keys");
    const request = store.put({ id, value, timestamp: Date.now() });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Recupera una clau de la base de dades
 * @param {string} id - ID de la clau
 * @returns {Promise<any>} Valor guardat
 */
async function getFromKeyStore(id) {
  const db = await openKeyDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["keys"], "readonly");
    const store = transaction.objectStore("keys");
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result?.value || null);
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Genera un device fingerprint únic (per aquest dispositiu)
 * @returns {Promise<string>} Fingerprint
 */
async function generateDeviceFingerprint() {
  // Recollir característiques del dispositiu
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency || 0,
    navigator.deviceMemory || 0,
  ];

  // Crear hash SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(components.join("|"));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);

  // Convertir a hex
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Genera o recupera el salt del dispositiu
 * @returns {Promise<Uint8Array>} Salt
 */
async function getDeviceSalt() {
  // Intentar recuperar salt existent
  let salt = await getFromKeyStore(DEVICE_SALT_ID);

  if (!salt) {
    // Generar nou salt
    salt = crypto.getRandomValues(new Uint8Array(32));
    await saveToKeyStore(DEVICE_SALT_ID, Array.from(salt));
    log.debug("Nou salt de dispositiu generat");
  } else {
    // Convertir de array a Uint8Array
    salt = new Uint8Array(salt);
  }

  return salt;
}

/**
 * Deriva una clau de wrapping del device fingerprint
 * @returns {Promise<CryptoKey>} Clau de wrapping
 */
async function deriveDeviceKey() {
  try {
    // Obtenir fingerprint i salt
    const fingerprint = await generateDeviceFingerprint();
    const salt = await getDeviceSalt();

    // Importar fingerprint com a clau base
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(fingerprint),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    );

    // Derivar clau de wrapping amb PBKDF2
    const deviceKey = await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000, // 100k iteracions per seguretat
        hash: "SHA-256",
      },
      keyMaterial,
      WRAPPING_CONFIG,
      false, // No exportable
      ["wrapKey", "unwrapKey"]
    );

    return deviceKey;
  } catch (error) {
    log.error("Error derivant clau de dispositiu:", error);
    throw error;
  }
}

/**
 * Genera una nova clau mestra
 * @returns {Promise<CryptoKey>} Clau mestra
 */
async function generateMasterKey() {
  try {
    log.debug("Generant nova clau mestra...");

    const masterKey = await crypto.subtle.generateKey(
      MASTER_KEY_CONFIG,
      true, // Extractable per poder wrapejar-la
      ["encrypt", "decrypt"]
    );

    log.debug("Clau mestra generada correctament");
    return masterKey;
  } catch (error) {
    log.error("Error generant clau mestra:", error);
    throw error;
  }
}

/**
 * Protegeix (wrap) la clau mestra amb la clau de dispositiu
 * @param {CryptoKey} masterKey - Clau mestra
 * @param {CryptoKey} deviceKey - Clau de wrapping
 * @returns {Promise<ArrayBuffer>} Clau mestra protegida
 */
async function wrapMasterKey(masterKey, deviceKey) {
  try {
    const wrappedKey = await crypto.subtle.wrapKey(
      "raw",
      masterKey,
      deviceKey,
      WRAPPING_CONFIG.name
    );

    return wrappedKey;
  } catch (error) {
    log.error("Error protegint clau mestra:", error);
    throw error;
  }
}

/**
 * Desprotegeix (unwrap) la clau mestra
 * @param {ArrayBuffer} wrappedKey - Clau mestra protegida
 * @param {CryptoKey} deviceKey - Clau de wrapping
 * @returns {Promise<CryptoKey>} Clau mestra
 */
async function unwrapMasterKey(wrappedKey, deviceKey) {
  try {
    const masterKey = await crypto.subtle.unwrapKey(
      "raw",
      wrappedKey,
      deviceKey,
      WRAPPING_CONFIG.name,
      MASTER_KEY_CONFIG,
      false, // No exportable després d'unwrap (més segur)
      ["encrypt", "decrypt"]
    );

    return masterKey;
  } catch (error) {
    log.error("Error desprotegint clau mestra:", error);
    throw error;
  }
}

/**
 * Inicialitza el sistema de claus (primera vegada)
 * Genera clau mestra i la protegeix amb device key
 */
export async function initializeKeySystem() {
  try {
    log.debug("🔐 Inicialitzant sistema de claus...");

    // Comprovar si ja existeix
    const existingWrappedKey = await getFromKeyStore(WRAPPED_KEY_ID);
    if (existingWrappedKey) {
      log.debug("✅ Sistema de claus ja inicialitzat");
      return;
    }

    // 1. Generar clau mestra
    const masterKey = await generateMasterKey();

    // 2. Derivar clau de dispositiu
    const deviceKey = await deriveDeviceKey();

    // 3. Protegir clau mestra amb device key
    const wrappedKey = await wrapMasterKey(masterKey, deviceKey);

    // 4. Guardar clau protegida
    await saveToKeyStore(
      WRAPPED_KEY_ID,
      Array.from(new Uint8Array(wrappedKey))
    );

    log.debug("✅ Sistema de claus inicialitzat correctament");
    log.debug("🔒 Protecció de dades activada");
  } catch (error) {
    log.error("❌ Error inicialitzant sistema de claus:", error);
    throw error;
  }
}

/**
 * Recupera la clau mestra (desprotegida i llesta per usar)
 * @returns {Promise<CryptoKey>} Clau mestra
 */
export async function getMasterKey() {
  try {
    // 1. Recuperar clau protegida
    const wrappedKeyArray = await getFromKeyStore(WRAPPED_KEY_ID);

    if (!wrappedKeyArray) {
      // ✅ FIX: Inicialitzar si no existeix
      log.warn(
        "⚠️ Clau mestra no trobada. Inicialitzant sistema automàticament..."
      );
      await initializeKeySystem();
      // Retry després d'inicialitzar
      const retryWrappedKey = await getFromKeyStore(WRAPPED_KEY_ID);
      if (!retryWrappedKey) {
        throw new Error("Failed to initialize key system");
      }
      return await getMasterKey();
    }

    // 2. Validar format
    if (!Array.isArray(wrappedKeyArray) || wrappedKeyArray.length === 0) {
      log.error("❌ Clau mestra corrupta (format invàlid). Reinicialitzant...");
      await resetKeySystem();
      await initializeKeySystem();
      throw new Error(
        "Key system was corrupted and has been reset. Please try again."
      );
    }

    // 3. Convertir array a ArrayBuffer
    const wrappedKey = new Uint8Array(wrappedKeyArray).buffer;

    // 4. Derivar clau de dispositiu
    const deviceKey = await deriveDeviceKey();

    // 5. Desprotegir clau mestra (amb retry si falla)
    try {
      const masterKey = await unwrapMasterKey(wrappedKey, deviceKey);
      return masterKey;
    } catch (unwrapError) {
      log.error(
        "❌ Error desprotegint clau (possiblement corrupta):",
        unwrapError
      );
      log.warn("🔄 Reinicialitzant sistema de claus...");

      // Reinicialitzar sistema si unwrap falla
      await resetKeySystem();
      await initializeKeySystem();

      throw new Error(
        "Key system was corrupted. System has been reset - please refresh the page."
      );
    }
  } catch (error) {
    log.error("Error recuperant clau mestra:", error);
    throw error;
  }
}

/**
 * Comprova si el sistema de claus està inicialitzat
 * @returns {Promise<boolean>} True si està inicialitzat
 */
export async function isKeySystemInitialized() {
  const wrappedKey = await getFromKeyStore(WRAPPED_KEY_ID);
  return !!wrappedKey;
}

/**
 * Reseteja tot el sistema de claus (PERILLÓS - només per debug/tests)
 * @warning Això farà que totes les dades encriptades siguin irrecuperables
 */
export async function resetKeySystem() {
  log.warn(
    "⚠️ RESETEJANT SISTEMA DE CLAUS - Les dades encriptades es perdran!"
  );

  const db = await openKeyDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["keys"], "readwrite");
    const store = transaction.objectStore("keys");
    const request = store.clear();

    request.onsuccess = () => {
      log.debug("✅ Sistema de claus resetejat");
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

/**
 * Exporta la clau mestra com a recovery phrase (12 paraules)
 * @returns {Promise<string>} Recovery phrase
 * @todo Implementar generació de mnemònic (BIP39)
 */
export async function exportRecoveryPhrase() {
  // TODO: Implementar amb BIP39 o similar
  log.warn("Recovery phrase no implementat encara");
  throw new Error("Not implemented yet");
}

/**
 * Importa clau mestra des d'una recovery phrase
 * @param {string} phrase - Recovery phrase
 * @returns {Promise<CryptoKey>} Clau mestra
 * @todo Implementar validació i importació de mnemònic
 */
export async function importFromRecoveryPhrase(phrase) {
  // TODO: Implementar amb BIP39 o similar
  log.warn("Import from recovery phrase no implementat encara");
  throw new Error("Not implemented yet");
}

export default {
  initializeKeySystem,
  getMasterKey,
  isKeySystemInitialized,
  resetKeySystem,
  exportRecoveryPhrase,
  importFromRecoveryPhrase,
};
