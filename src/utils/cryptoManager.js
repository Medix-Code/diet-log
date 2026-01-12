/**
 * CryptoManager - Sistema d'encriptació transparent amb Web Crypto API
 *
 * Funcionalitats:
 * - Encriptació/desencriptació AES-GCM 256-bit
 * - Generació automàtica d'IVs únics
 * - Validació d'integritat de dades
 * - Suport per versionat d'encriptació
 * - Zero-knowledge: dades sensibles mai surten del dispositiu
 *
 * @module cryptoManager
 * @version 1.0.0 (2025)
 */

import { logger } from "./logger.js";

const log = logger.withScope("CryptoManager");

// Constants d'encriptació
const ENCRYPTION_VERSION = 1;
const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits (recomanat per AES-GCM)
const TAG_LENGTH = 128; // 128 bits (màxima seguretat)

/**
 * Configuració de l'algoritme AES-GCM
 */
const CRYPTO_CONFIG = {
  name: ALGORITHM,
  length: KEY_LENGTH,
};

/**
 * Camps que s'han d'encriptar (dades sensibles)
 */
const SENSITIVE_FIELDS = [
  "person1", // Nom conductor
  "person2", // Nom ajudant
  "vehicleNumber", // Número de vehicle
  "signatureConductor", // Signatura conductor
  "signatureAjudant", // Signatura ajudant
];

/**
 * Camps de serveis que s'han d'encriptar
 */
const SENSITIVE_SERVICE_FIELDS = [
  "serviceNumber", // Número de servei
  "origin", // Origen
  "destination", // Destí
  "notes", // Notes del servei
];

/**
 * Comprova si una dieta està encriptada
 * @param {Object} diet - Objecte dieta
 * @returns {boolean} True si està encriptada
 */
export function isEncrypted(diet) {
  return !!(
    diet &&
    diet.encryption &&
    diet.encryption.version &&
    diet.encryptedData
  );
}

/**
 * Genera un IV (Initialization Vector) aleatori
 * @returns {Uint8Array} IV de 12 bytes
 */
function generateIV() {
  return crypto.getRandomValues(new Uint8Array(IV_LENGTH));
}

/**
 * Converteix ArrayBuffer a Base64 (mètode segur amb Unicode)
 * Usa base64url encoding per evitar problemes amb caràcters especials
 * @param {ArrayBuffer} buffer - Buffer a convertir
 * @returns {string} String en Base64
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);

  // Mètode 1 (NOU): Usar base64url encoding (més segur)
  // Converteix a string binari i després a base64
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte)
  ).join("");

  // Usar btoa (compatible amb mètode antic per no trencar dietes existents)
  return btoa(binString);
}

/**
 * Converteix Base64 a ArrayBuffer amb fallback per compatibilitat
 * Suporta AMBDÓS formats: antic (btoa/atob) i nou (base64url)
 * @param {string} base64 - String en Base64
 * @returns {ArrayBuffer} ArrayBuffer
 */
function base64ToArrayBuffer(base64) {
  try {
    // Intent 1: Mètode ANTIC (per dietes existents)
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (error) {
    // Intent 2: Fallback per possibles problemes Unicode
    log.warn("[CryptoManager] Usant fallback per Base64 decoding");

    // Intentar decodificar amb base64url
    try {
      const binary = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    } catch (fallbackError) {
      log.error("[CryptoManager] Error desencriptant Base64:", fallbackError);
      throw new Error("Dades encriptades corruptes o format incompatible");
    }
  }
}

/**
 * Separa dades públiques de dades sensibles
 * @param {Object} diet - Dieta completa
 * @returns {Object} { publicData, sensitiveData }
 */
export function separateData(diet) {
  const publicData = {
    id: diet.id,
    date: diet.date,
    dietType: diet.dietType,
    serviceType: diet.serviceType,
    createdAt: diet.createdAt || Date.now(),
    updatedAt: Date.now(),
  };

  const sensitiveData = {
    // Dades generals sensibles
    generalData: {},
    // Dades de serveis sensibles
    servicesData: [],
  };

  // Extreure camps sensibles generals
  SENSITIVE_FIELDS.forEach((field) => {
    if (diet[field] !== undefined) {
      sensitiveData.generalData[field] = diet[field];
    }
  });

  // Extreure camps sensibles de serveis
  if (Array.isArray(diet.services)) {
    sensitiveData.servicesData = diet.services.map((service) => {
      const sensibleService = {};
      const publicService = {};

      // Separar camps sensibles de públics
      Object.keys(service).forEach((key) => {
        if (SENSITIVE_SERVICE_FIELDS.includes(key)) {
          sensibleService[key] = service[key];
        } else {
          publicService[key] = service[key];
        }
      });

      return { sensitive: sensibleService, public: publicService };
    });
  }

  // Afegir dades públiques de serveis
  publicData.services = sensitiveData.servicesData.map((s) => s.public);

  return { publicData, sensitiveData };
}

/**
 * Fusiona dades públiques amb dades sensibles desencriptades
 * @param {Object} publicData - Dades públiques
 * @param {Object} sensitiveData - Dades sensibles
 * @returns {Object} Dieta completa
 */
export function mergeData(publicData, sensitiveData) {
  const diet = { ...publicData };

  // Fusionar dades generals sensibles
  if (sensitiveData.generalData) {
    Object.assign(diet, sensitiveData.generalData);
  }

  // Fusionar dades de serveis
  if (
    Array.isArray(publicData.services) &&
    Array.isArray(sensitiveData.servicesData)
  ) {
    diet.services = publicData.services.map((publicService, index) => {
      const sensitiveService =
        sensitiveData.servicesData[index]?.sensitive || {};
      return { ...publicService, ...sensitiveService };
    });
  }

  return diet;
}

/**
 * Encripta dades amb AES-GCM
 * @param {Object} data - Dades a encriptar
 * @param {CryptoKey} key - Clau de xifrat
 * @returns {Promise<Object>} Dades encriptades amb metadades
 */
async function encryptData(data, key) {
  try {
    // Convertir dades a JSON i després a ArrayBuffer
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(data));

    // Generar IV únic per aquesta encriptació
    const iv = generateIV();

    // Encriptar amb AES-GCM
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: ALGORITHM,
        iv: iv,
        tagLength: TAG_LENGTH,
      },
      key,
      dataBuffer
    );

    // Retornar dades encriptades + metadades
    return {
      data: arrayBufferToBase64(encryptedBuffer),
      iv: arrayBufferToBase64(iv),
      algorithm: ALGORITHM,
      version: ENCRYPTION_VERSION,
    };
  } catch (error) {
    log.error("Error encriptant dades:", error);
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Desencripta dades amb AES-GCM
 * @param {Object} encryptedData - Dades encriptades amb metadades
 * @param {CryptoKey} key - Clau de desxifrat
 * @returns {Promise<Object>} Dades desencriptades
 */
async function decryptData(encryptedData, key) {
  try {
    // Validar format
    if (!encryptedData || !encryptedData.data || !encryptedData.iv) {
      throw new Error("Invalid encrypted data format");
    }

    // Convertir de Base64 a ArrayBuffer
    const encryptedBuffer = base64ToArrayBuffer(encryptedData.data);
    const iv = base64ToArrayBuffer(encryptedData.iv);

    // Desencriptar - Usar Uint8Array directament enlloc d'ArrayBuffer
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: ALGORITHM,
        iv: new Uint8Array(iv),
        tagLength: TAG_LENGTH,
      },
      key,
      new Uint8Array(encryptedBuffer) // ← AQUÍ! Passar Uint8Array directament
    );

    // Convertir de ArrayBuffer a Object
    const decoder = new TextDecoder();
    const jsonString = decoder.decode(decryptedBuffer);

    return JSON.parse(jsonString);
  } catch (error) {
    log.error("Error desencriptant dades:", error);
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

/**
 * Calcula checksum SHA-256 per validació d'integritat
 * @param {string} data - Dades a validar
 * @returns {Promise<string>} Checksum en hexadecimal
 */
async function calculateChecksum(data) {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);

    // Convertir a hexadecimal
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    log.error("Error calculant checksum:", error);
    return "";
  }
}

/**
 * Encripta una dieta completa (API pública)
 * @param {Object} diet - Dieta a encriptar
 * @param {CryptoKey} key - Clau mestra
 * @returns {Promise<Object>} Dieta amb dades sensibles encriptades
 */
export async function encryptDiet(diet, key) {
  try {
    log.debug("Encriptant dieta:", diet.id);

    // 1. Separar dades públiques de sensibles
    const { publicData, sensitiveData } = separateData(diet);

    // 2. Encriptar només les dades sensibles
    const encrypted = await encryptData(sensitiveData, key);

    // 3. Calcular checksum per integritat
    const checksum = await calculateChecksum(encrypted.data);

    // 4. Crear objecte final
    const encryptedDiet = {
      ...publicData,
      encryption: {
        version: encrypted.version,
        algorithm: encrypted.algorithm,
        iv: encrypted.iv,
      },
      encryptedData: encrypted.data,
      checksum: checksum,
    };

    log.debug("Dieta encriptada correctament:", diet.id);
    return encryptedDiet;
  } catch (error) {
    log.error("Error encriptant dieta:", error);
    throw error;
  }
}

/**
 * Desencripta una dieta completa (API pública)
 * @param {Object} encryptedDiet - Dieta encriptada
 * @param {CryptoKey} key - Clau mestra
 * @param {Object} options - Opcions (showChecksumWarning: boolean)
 * @returns {Promise<Object>} Dieta desencriptada
 */
export async function decryptDiet(encryptedDiet, key, options = {}) {
  const { showChecksumWarning = true } = options;

  try {
    log.debug("Desencriptant dieta:", encryptedDiet.id);

    // 1. Validar checksum (integritat)
    let checksumValid = true;
    if (encryptedDiet.checksum) {
      const currentChecksum = await calculateChecksum(
        encryptedDiet.encryptedData
      );
      if (currentChecksum !== encryptedDiet.checksum) {
        checksumValid = false;
        log.error(
          `⚠️ CHECKSUM MISMATCH per dieta ${encryptedDiet.id} - Integritat compromesa`
        );

        // Mostrar advertència a l'usuari si està habilitat
        if (showChecksumWarning && typeof window !== "undefined") {
          // Dinàmicament importar showToast per evitar dependencies circulars
          try {
            const { showToast } = await import("../ui/toast.js");
            showToast(
              `⚠️ Advertència: Les dades d'aquesta dieta poden estar corruptes. El checksum no coincideix.`,
              "warning",
              7000
            );
          } catch (importError) {
            // Si no podem importar showToast, només loggejar
            log.warn("No s'ha pogut mostrar alerta de checksum a l'usuari");
          }
        }

        // Continuar amb la desencriptació (AES-GCM detectarà manipulació)
        log.warn(
          "Continuant amb desencriptació malgrat checksum invàlid (AES-GCM validarà integritat)"
        );
      }
    }

    // 2. Preparar dades encriptades
    const encryptedData = {
      data: encryptedDiet.encryptedData,
      iv: encryptedDiet.encryption.iv,
      algorithm: encryptedDiet.encryption.algorithm,
      version: encryptedDiet.encryption.version,
    };

    // 3. Desencriptar dades sensibles
    const sensitiveData = await decryptData(encryptedData, key);

    // 4. Fusionar amb dades públiques
    const publicData = { ...encryptedDiet };
    delete publicData.encryption;
    delete publicData.encryptedData;
    delete publicData.checksum;

    const diet = mergeData(publicData, sensitiveData);

    // Afegir metadades de validació al log
    log.debug(
      `Dieta desencriptada correctament: ${diet.id} (checksum: ${
        checksumValid ? "✅ vàlid" : "⚠️ invàlid"
      })`
    );
    return diet;
  } catch (error) {
    log.error("Error desencriptant dieta:", error);

    // Millorar missatge d'error per l'usuari
    if (error.name === "OperationError") {
      throw new Error(
        "Les dades estan corruptes o s'ha utilitzat una clau incorrecta"
      );
    }

    throw error;
  }
}

/**
 * Valida que una encriptació/desencriptació funciona correctament
 * @param {Object} originalData - Dades originals
 * @param {CryptoKey} key - Clau de test
 * @returns {Promise<boolean>} True si passa validació
 */
export async function validateEncryption(originalData, key) {
  try {
    // Encriptar
    const encrypted = await encryptData(originalData, key);

    // Desencriptar
    const decrypted = await decryptData(encrypted, key);

    // Comparar
    const originalJson = JSON.stringify(originalData);
    const decryptedJson = JSON.stringify(decrypted);

    return originalJson === decryptedJson;
  } catch (error) {
    log.error("Validació d'encriptació fallida:", error);
    return false;
  }
}

export default {
  isEncrypted,
  encryptDiet,
  decryptDiet,
  separateData,
  mergeData,
  validateEncryption,
  ENCRYPTION_VERSION,
  ALGORITHM,
};
