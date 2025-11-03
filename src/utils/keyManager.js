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
const globalScope = typeof globalThis !== "undefined" ? globalThis : {};

export class EncryptionSupportError extends Error {
  /**
   * @param {string} message - Missatge descriptiu
   * @param {Error} [cause] - Error original
   */
  constructor(message, cause) {
    super(message);
    this.name = "EncryptionSupportError";
    if (cause) {
      this.cause = cause;
    }
  }
}

// Constants
const KEY_STORE_NAME = "encryption-keys";
const KEY_STORE_VERSION = 1;
const MASTER_KEY_ID = "master-key-v1";
const WRAPPED_KEY_ID = "wrapped-master-key";
const DEVICE_SALT_ID = "device-salt";
const MAX_KEY_RECOVERY_ATTEMPTS = 2;

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

function assertEncryptionSupport() {
  if (!globalScope || typeof window === "undefined") {
    throw new EncryptionSupportError(
      "Entorn sense API de navegador: l'encriptació necessita accedir a WebCrypto i IndexedDB."
    );
  }

  const cryptoApi = globalScope.crypto;
  if (!cryptoApi || typeof cryptoApi.subtle === "undefined") {
    throw new EncryptionSupportError(
      "WebCrypto API no disponible. Reviseu la configuració del navegador o el mode privat."
    );
  }

  if (typeof globalScope.indexedDB === "undefined") {
    throw new EncryptionSupportError(
      "IndexedDB no disponible o bloquejat. L'encriptació queda deshabilitada."
    );
  }
}

export function isEncryptionEnvironmentSupported() {
  try {
    assertEncryptionSupport();
    return true;
  } catch (error) {
    return false;
  }
}

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
 * Genera o recupera el salt del dispositiu
 * Aquest salt és l'únic element que fa la clau única per aquest navegador/dispositiu
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
 * Deriva una clau de wrapping del salt del dispositiu
 * NOTA: Ja no usem device fingerprint perquè pot canviar (mode responsiu, etc.)
 * @returns {Promise<CryptoKey>} Clau de wrapping
 */
async function deriveDeviceKey() {
  try {
    log.debug("🔑 Derivant clau de dispositiu...");

    // Obtenir salt (únic per aquest dispositiu/navegador)
    const salt = await getDeviceSalt();
    log.debug(`Salt length: ${salt.length} bytes`);

    // Usar una passphrase fixa + salt aleatori
    // El salt aleatori proporciona la unicitat necessària
    const passphrase = "diet-log-encryption-v1";

    // Importar passphrase com a clau base
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(passphrase),
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

    log.debug("✅ Clau de dispositiu derivada");
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

    log.debug(`Clau protegida: ${wrappedKey.byteLength} bytes`);
    return wrappedKey;
  } catch (error) {
    log.error("Error protegint clau mestra:", error);
    throw error;
  }
}

/**
 * Desprotegeix (unwrap) la clau mestra
 * @param {ArrayBuffer|Uint8Array} wrappedKey - Clau mestra protegida
 * @param {CryptoKey} deviceKey - Clau de wrapping
 * @returns {Promise<CryptoKey>} Clau mestra
 */
async function unwrapMasterKey(wrappedKey, deviceKey) {
  try {
    // Assegurar que tenim un ArrayBuffer proper
    let keyBuffer = wrappedKey;
    if (wrappedKey instanceof Uint8Array) {
      // Crear una còpia real, no només una referència al buffer
      keyBuffer = wrappedKey.buffer.slice(
        wrappedKey.byteOffset,
        wrappedKey.byteOffset + wrappedKey.byteLength
      );
    } else if (!(wrappedKey instanceof ArrayBuffer)) {
      // Si és un array normal, convertir-lo
      keyBuffer = new Uint8Array(wrappedKey).buffer;
    }

    log.debug(
      `Unwrapping key with buffer length: ${keyBuffer.byteLength} bytes`
    );

    const masterKey = await crypto.subtle.unwrapKey(
      "raw",
      keyBuffer,
      deviceKey,
      WRAPPING_CONFIG.name,
      MASTER_KEY_CONFIG,
      false, // No exportable després d'unwrap (més segur)
      ["encrypt", "decrypt"]
    );

    log.debug("✅ Clau desprotegida correctament");
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
    assertEncryptionSupport();
    log.debug("🔐 Inicialitzant sistema de claus...");

    // Comprovar si ja existeix
    const existingWrappedKey = await getFromKeyStore(WRAPPED_KEY_ID);
    if (existingWrappedKey) {
      log.debug("⚠️ Sistema de claus ja inicialitzat. Validant integritat...");

      // VALIDAR que la clau existent funciona!
      try {
        const deviceKey = await deriveDeviceKey();
        const testWrappedKey = new Uint8Array(existingWrappedKey);
        await unwrapMasterKey(testWrappedKey, deviceKey);
        log.debug("✅ Clau existent validada correctament");
        return; // Tot OK
      } catch (validationError) {
        log.warn(
          "⚠️ Clau existent corrupta o incompatible. Re-inicialitzant..."
        );
        log.warn("Error de validació:", validationError);

        // Resetjar i continuar amb la creació d'una nova clau
        await resetKeySystem(true);
        log.debug("🔄 Sistema resetejat. Creant nova clau...");
      }
    }

    // 1. Generar clau mestra
    const masterKey = await generateMasterKey();

    // 2. Derivar clau de dispositiu
    const deviceKey = await deriveDeviceKey();

    // 3. Protegir clau mestra amb device key
    const wrappedKey = await wrapMasterKey(masterKey, deviceKey);

    // 4. Guardar clau protegida
    const wrappedKeyArray = Array.from(new Uint8Array(wrappedKey));
    await saveToKeyStore(WRAPPED_KEY_ID, wrappedKeyArray);

    log.debug(
      `✅ Clau protegida guardada a IndexedDB (${wrappedKeyArray.length} bytes)`
    );

    // 5. VALIDACIÓ IMMEDIATA: Intentar desprotegir amb la mateixa clau
    try {
      log.debug("🔍 Validant que la clau es pot recuperar...");
      const testWrappedKey = new Uint8Array(wrappedKeyArray);
      await unwrapMasterKey(testWrappedKey, deviceKey);
      log.debug("✅ Validació exitosa: la clau es pot recuperar correctament");
    } catch (validationError) {
      log.error(
        "❌ VALIDACIÓ FALLIDA: La clau no es pot recuperar després de crear-la!"
      );
      log.error("Error de validació:", validationError);

      // Resetjar i llançar error
      await resetKeySystem(true);
      throw new Error(
        `Key system validation failed: ${validationError.message}. ` +
          "Possible browser incompatibility with AES-KW algorithm."
      );
    }

    log.debug("✅ Sistema de claus inicialitzat i validat correctament");
    log.debug("🔒 Protecció de dades activada");
  } catch (error) {
    if (!(error instanceof EncryptionSupportError)) {
      const unsupportedErrorNames = new Set([
        "SecurityError",
        "InvalidStateError",
        "NotAllowedError",
        "QuotaExceededError",
      ]);

      if (unsupportedErrorNames.has(error?.name)) {
        throw new EncryptionSupportError(
          "El navegador ha bloquejat l'accés a IndexedDB o WebCrypto.",
          error
        );
      }
    }

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
    assertEncryptionSupport();

    // 1. Recuperar clau protegida
    const wrappedKeyArray = await getFromKeyStore(WRAPPED_KEY_ID);

    if (!wrappedKeyArray) {
      // Inicialitzar si no existeix
      log.warn(
        "⚠️ Clau mestra no trobada. Inicialitzant sistema automàticament..."
      );
      await initializeKeySystem();

      // Retry després d'inicialitzar
      const retryWrappedKey = await getFromKeyStore(WRAPPED_KEY_ID);
      if (!retryWrappedKey) {
        throw new Error("Failed to initialize key system");
      }

      // Tornar a cridar recursivament (només una vegada)
      const deviceKey = await deriveDeviceKey();
      const wrappedKey = new Uint8Array(retryWrappedKey).buffer;
      return await unwrapMasterKey(wrappedKey, deviceKey);
    }

    // 2. Validar format
    if (!Array.isArray(wrappedKeyArray) || wrappedKeyArray.length === 0) {
      throw new Error(
        "Clau mestra amb format invàlid. Executa diagnoseKeySystem() per més detalls."
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
      // ❌ NO auto-resetjar - això destrueix les dades encriptades existents
      log.error("⛔ Error CRÍTIC desprotegint clau mestra:", unwrapError);

      // Donar informació útil a l'usuari
      const userMessage =
        "El sistema de claus està corrupte o el dispositiu ha canviat. " +
        "Les dotacions encriptades no es poden recuperar sense la clau original. " +
        "Opcions: 1) Prova a recarregar la pàgina, 2) Exporta dades i reseteja l'aplicació.";

      log.error(userMessage);

      throw new Error(
        `Key unwrap failed: ${unwrapError.message}. ` +
          `Això pot passar si has canviat de navegador/dispositiu o les dades estan corruptes. ` +
          `SOLUCIÓ: Reseteja el sistema de claus des de Configuració.`
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
  if (!isEncryptionEnvironmentSupported()) {
    return false;
  }

  const wrappedKey = await getFromKeyStore(WRAPPED_KEY_ID);
  return !!wrappedKey;
}

/**
 * Reseteja tot el sistema de claus (PERILLÓS - només per debug/tests)
 * @warning Això farà que totes les dades encriptades siguin irrecuperables
 * @param {boolean} confirmed - Confirmació explícita de l'usuari
 */
export async function resetKeySystem(confirmed = false) {
  if (!confirmed) {
    throw new Error(
      "resetKeySystem requereix confirmació explícita (confirmed=true). " +
        "ATENCIÓ: Això farà que totes les dades encriptades siguin irrecuperables."
    );
  }

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
 * Diagnostica l'estat del sistema de claus
 * @returns {Promise<Object>} Estat detallat del sistema
 */
export async function diagnoseKeySystem() {
  try {
    const diagnosis = {
      encryptionSupported: isEncryptionEnvironmentSupported(),
      keySystemInitialized: false,
      wrappedKeyExists: false,
      wrappedKeyValid: false,
      deviceSaltExists: false,
      canUnwrap: false,
      errors: [],
    };

    if (!diagnosis.encryptionSupported) {
      diagnosis.errors.push("WebCrypto or IndexedDB not supported");
      return diagnosis;
    }

    // Comprovar si existeix clau wrapped
    const wrappedKeyArray = await getFromKeyStore(WRAPPED_KEY_ID);
    diagnosis.wrappedKeyExists = !!wrappedKeyArray;
    diagnosis.keySystemInitialized = diagnosis.wrappedKeyExists;

    if (wrappedKeyArray) {
      diagnosis.wrappedKeyValid =
        Array.isArray(wrappedKeyArray) && wrappedKeyArray.length > 0;
    }

    // Comprovar si existeix salt
    const salt = await getFromKeyStore(DEVICE_SALT_ID);
    diagnosis.deviceSaltExists = !!salt;

    // Intentar unwrap (sense resetjar si falla)
    if (diagnosis.wrappedKeyExists && diagnosis.wrappedKeyValid) {
      try {
        const wrappedKey = new Uint8Array(wrappedKeyArray).buffer;
        const deviceKey = await deriveDeviceKey();
        await unwrapMasterKey(wrappedKey, deviceKey);
        diagnosis.canUnwrap = true;
      } catch (unwrapError) {
        diagnosis.canUnwrap = false;
        diagnosis.errors.push(`Unwrap failed: ${unwrapError.message}`);
      }
    }

    return diagnosis;
  } catch (error) {
    return {
      encryptionSupported: false,
      keySystemInitialized: false,
      wrappedKeyExists: false,
      wrappedKeyValid: false,
      deviceSaltExists: false,
      canUnwrap: false,
      errors: [`Diagnosis failed: ${error.message}`],
    };
  }
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
  diagnoseKeySystem,
  exportRecoveryPhrase,
  importFromRecoveryPhrase,
  EncryptionSupportError,
  isEncryptionEnvironmentSupported,
};
