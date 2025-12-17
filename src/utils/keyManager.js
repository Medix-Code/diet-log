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

export class RecoveryPhraseNotSupportedError extends Error {
  constructor(message = "Funcionalitat de recovery phrase desactivada") {
    super(message);
    this.name = "RecoveryPhraseNotSupportedError";
  }
}

// Constants
const KEY_STORE_NAME = "encryption-keys";
const KEY_STORE_VERSION = 1;
const MASTER_KEY_ID = "master-key-v1";
const WRAPPED_KEY_ID = "wrapped-master-key";
const DEVICE_SALT_ID = "device-salt";
const MAX_KEY_RECOVERY_ATTEMPTS = 2;
export const RECOVERY_PHRASE_ENABLED = false;

// Seguretat de memòria: Cache temporal amb WeakRef i timeouts
const KEY_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minuts
let cachedMasterKeyRef = null; // WeakRef per permetre garbage collection
let keyCacheTimeout = null; // Timeout per neteja automàtica

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
export async function saveToKeyStore(id, value) {
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
export async function getFromKeyStore(id) {
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
 * Genera un fingerprint del navegador basat en característiques estables
 * NOTA: Només usa característiques que no canvien amb mode responsiu
 * @returns {string} Fingerprint del navegador
 */
function getBrowserFingerprint() {
  const components = [
    navigator.userAgent || "",
    navigator.language || "",
    navigator.hardwareConcurrency || 0,
    // NO usar screen.width/height (canvia amb mode responsiu)
    navigator.platform || "",
    // Timezone offset (més estable)
    new Date().getTimezoneOffset(),
  ];

  // Combinar components
  return components.join("|");
}

/**
 * Deriva una clau de wrapping del salt del dispositiu + fingerprint
 * IMPORTANT: Manté compatibilitat amb dietes antigues usant passphrase fixa com a fallback
 * @param {boolean} useLegacyPassphrase - Si true, usa passphrase antiga (per compatibilitat)
 * @returns {Promise<CryptoKey>} Clau de wrapping
 */
async function deriveDeviceKey(useLegacyPassphrase = false) {
  try {
    log.debug("🔑 Derivant clau de dispositiu...");

    // Obtenir salt (únic per aquest dispositiu/navegador)
    const salt = await getDeviceSalt();
    log.debug(`Salt length: ${salt.length} bytes`);

    let passphrase;

    if (useLegacyPassphrase) {
      // LEGACY: Passphrase fixa (per dietes antigues)
      passphrase = "diet-log-encryption-v1";
      log.debug("Usant passphrase legacy per compatibilitat");
    } else {
      // NOU: Derivar de fingerprint del navegador
      const fingerprint = getBrowserFingerprint();
      passphrase = `diet-log-v2-${fingerprint}`;
      log.debug("Usant passphrase derivada de fingerprint");
    }

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
 * Desprotegeix (unwrap) la clau mestra amb fallback per compatibilitat
 * IMPORTANT: Intenta amb nova passphrase, si falla usa legacy (dietes antigues)
 * @param {ArrayBuffer|Uint8Array} wrappedKey - Clau mestra protegida
 * @param {CryptoKey} [deviceKey] - Clau de wrapping (opcional, es derivarà si no es proporciona)
 * @param {boolean} [useLegacyPassphrase] - Si true, usa passphrase antiga
 * @returns {Promise<CryptoKey>} Clau mestra
 */
async function unwrapMasterKey(wrappedKey, deviceKey = null, useLegacyPassphrase = false) {
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

    // Derivar device key si no es proporciona
    const unwrapDeviceKey = deviceKey || await deriveDeviceKey(useLegacyPassphrase);

    const masterKey = await crypto.subtle.unwrapKey(
      "raw",
      keyBuffer,
      unwrapDeviceKey,
      WRAPPING_CONFIG.name,
      MASTER_KEY_CONFIG,
      false, // No exportable després d'unwrap (més segur)
      ["encrypt", "decrypt"]
    );

    log.debug("✅ Clau desprotegida correctament");
    return masterKey;
  } catch (error) {
    // Si falla i NO estem usant legacy, intentar amb legacy (dietes antigues)
    if (!useLegacyPassphrase) {
      log.warn("⚠️ Fallant amb nova passphrase, provant amb legacy per compatibilitat...");
      try {
        return await unwrapMasterKey(wrappedKey, null, true);
      } catch (legacyError) {
        log.error("Error desprotegint amb legacy passphrase:", legacyError);
        throw new Error("No s'ha pogut desencriptar la clau mestra (incompatibilitat de versions)");
      }
    }

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
 * Neteja el cache de claus forçant alliberament de memòria
 * Exportat per permetre neteja manual si necessari (per exemple, al logout)
 */
export function clearKeyCache() {
  if (keyCacheTimeout) {
    clearTimeout(keyCacheTimeout);
    keyCacheTimeout = null;
  }
  cachedMasterKeyRef = null;
  log.debug("🧹 Cache de claus netejat");
}

/**
 * Guarda clau al cache temporal amb TTL
 * @param {CryptoKey} key - Clau a guardar temporalment
 */
function cacheKey(key) {
  // Netejar timeout anterior
  if (keyCacheTimeout) {
    clearTimeout(keyCacheTimeout);
  }

  // Usar WeakRef per permetre garbage collection
  cachedMasterKeyRef = new WeakRef(key);

  // Programar neteja automàtica
  keyCacheTimeout = setTimeout(() => {
    clearKeyCache();
    log.debug(`⏰ Cache de claus expirat després de ${KEY_CACHE_TTL_MS}ms`);
  }, KEY_CACHE_TTL_MS);

  log.debug(`💾 Clau guardada al cache (TTL: ${KEY_CACHE_TTL_MS}ms)`);
}

/**
 * Intenta recuperar clau del cache si encara és vàlida
 * @returns {CryptoKey|null} Clau si existeix i és vàlida, null altrament
 */
function getCachedKey() {
  if (!cachedMasterKeyRef) {
    return null;
  }

  const key = cachedMasterKeyRef.deref();
  if (!key) {
    log.debug("🗑️ Clau al cache ja ha estat garbage collected");
    clearKeyCache();
    return null;
  }

  log.debug("✅ Clau recuperada del cache");
  return key;
}

/**
 * Recupera la clau mestra (desprotegida i llesta per usar)
 * Utilitza cache temporal amb TTL per millorar rendiment
 * @returns {Promise<CryptoKey>} Clau mestra
 */
export async function getMasterKey() {
  try {
    assertEncryptionSupport();

    // 0. Intentar recuperar del cache primer
    const cachedKey = getCachedKey();
    if (cachedKey) {
      return cachedKey;
    }

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
      // Usa la nova passphrase per defecte (es farà fallback automàtic si cal)
      const wrappedKey = new Uint8Array(retryWrappedKey).buffer;
      return await unwrapMasterKey(wrappedKey);
    }

    // 2. Validar format
    if (!Array.isArray(wrappedKeyArray) || wrappedKeyArray.length === 0) {
      throw new Error(
        "Clau mestra amb format invàlid. Executa diagnoseKeySystem() per més detalls."
      );
    }

    // 3. Convertir array a ArrayBuffer
    const wrappedKey = new Uint8Array(wrappedKeyArray).buffer;

    // 4. Desprotegir clau mestra (amb fallback automàtic a legacy)
    // NO especifiquem deviceKey per permetre que unwrapMasterKey faci el fallback
    try {
      const masterKey = await unwrapMasterKey(wrappedKey);

      // Guardar al cache amb TTL per futures operacions
      cacheKey(masterKey);

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

  // Netejar cache de memòria abans de resetjar
  clearKeyCache();

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
 */
export async function exportRecoveryPhrase() {
  log.warn("Export de recovery phrase desactivat (feature no disponible)");
  throw new RecoveryPhraseNotSupportedError();
}

/**
 * Importa clau mestra des d'una recovery phrase
 * @param {string} phrase - Recovery phrase
 * @returns {Promise<CryptoKey>} Clau mestra
 */
export async function importFromRecoveryPhrase(phrase) {
  log.warn("Import de recovery phrase desactivat (feature no disponible)", {
    hasPhrase: !!phrase,
  });
  throw new RecoveryPhraseNotSupportedError();
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
  RecoveryPhraseNotSupportedError,
  isEncryptionEnvironmentSupported,
  RECOVERY_PHRASE_ENABLED,
};
