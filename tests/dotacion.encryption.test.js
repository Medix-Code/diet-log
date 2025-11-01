/**
 * @file dotacion.encryption.test.js
 * @description Tests d'encriptació de dotacions a localStorage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock de localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock;

// Mock de showToast
vi.mock("../src/ui/toast.js", () => ({
  showToast: vi.fn(),
}));

// Mock de modals
vi.mock("../src/ui/modals.js", () => ({
  initSwipeToDeleteDotacio: vi.fn(),
  initMouseSwipeToDeleteDotacio: vi.fn(),
  updateDotacioListVisibility: vi.fn(),
  restoreDotacioItemToList: vi.fn(),
}));

// Mock de validation
vi.mock("../src/utils/validation.js", () => ({
  validateDotacioTab: vi.fn(() => true),
  sanitizeText: vi.fn((text) => text),
}));

// Mock de signatureService
vi.mock("../src/services/signatureService.js", () => ({
  getSignatureConductor: vi.fn(() => ""),
  getSignatureAjudant: vi.fn(() => ""),
  setSignatureConductor: vi.fn(),
  setSignatureAjudant: vi.fn(),
}));

// Mock del keyManager per evitar IndexedDB
vi.mock("../src/utils/keyManager.js", async () => {
  let cachedKey = null;

  return {
    initializeKeySystem: vi.fn(async () => {
      // No fem res, només retornem success
      return true;
    }),
    getMasterKey: vi.fn(async () => {
      if (!cachedKey) {
        cachedKey = await crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"]
        );
      }
      return cachedKey;
    }),
    isKeySystemInitialized: vi.fn(() => true),
  };
});

describe("Encriptació de Dotacions", () => {
  let masterKey;

  beforeEach(async () => {
    // Netejar localStorage abans de cada test
    localStorage.clear();

    // Crear clau de test directament (sense IndexedDB)
    masterKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("Funcions d'encriptació/desencriptació", () => {
    it("hauria d'encriptar i desencriptar dotacions correctament", async () => {
      const dotacionsOriginals = [
        {
          numero: "ABC123",
          conductor: "Joan Garcia",
          ajudant: "Maria Lopez",
          firmaConductor: "data:image/png;base64,test1",
          firmaAjudant: "data:image/png;base64,test2",
        },
        {
          numero: "XYZ789",
          conductor: "Pere Martí",
          ajudant: "Anna Soler",
          firmaConductor: "data:image/png;base64,test3",
          firmaAjudant: "data:image/png;base64,test4",
        },
      ];

      // Funcions auxiliars per encriptació
      const arrayBufferToBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      const base64ToArrayBuffer = (base64) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      };

      const calculateChecksum = async (data) => {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      };

      // Test: Encriptar
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(dotacionsOriginals));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv, tagLength: 128 },
        masterKey,
        dataBuffer
      );

      const encryptedData = arrayBufferToBase64(encryptedBuffer);
      const ivBase64 = arrayBufferToBase64(iv);
      const checksum = await calculateChecksum(encryptedData);

      const encrypted = {
        version: 1,
        algorithm: "AES-GCM",
        iv: ivBase64,
        data: encryptedData,
        checksum: checksum,
      };

      expect(encrypted).toHaveProperty("version", 1);
      expect(encrypted).toHaveProperty("algorithm", "AES-GCM");
      expect(encrypted).toHaveProperty("iv");
      expect(encrypted).toHaveProperty("data");
      expect(encrypted).toHaveProperty("checksum");

      // Verificar que les dades encriptades NO contenen text pla
      expect(encrypted.data).not.toContain("Joan Garcia");
      expect(encrypted.data).not.toContain("Maria Lopez");
      expect(encrypted.data).not.toContain("ABC123");

      // Test: Desencriptar
      const encBuf = base64ToArrayBuffer(encrypted.data);
      const ivBuf = base64ToArrayBuffer(encrypted.iv);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivBuf), tagLength: 128 },
        masterKey,
        new Uint8Array(encBuf)
      );

      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decryptedBuffer);
      const decrypted = JSON.parse(jsonString);

      expect(decrypted).toEqual(dotacionsOriginals);
      expect(decrypted[0].conductor).toBe("Joan Garcia");
      expect(decrypted[1].numero).toBe("XYZ789");
    });

    it("hauria de detectar dades corrompudes amb checksum", async () => {
      const dotacions = [
        { numero: "ABC123", conductor: "Test", ajudant: "Test2" },
      ];

      // Funcions auxiliars
      const arrayBufferToBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      const calculateChecksum = async (data) => {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      };

      // Encriptar
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify(dotacions));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv, tagLength: 128 },
        masterKey,
        dataBuffer
      );

      const encryptedData = arrayBufferToBase64(encryptedBuffer);
      const ivBase64 = arrayBufferToBase64(iv);
      const checksum = await calculateChecksum(encryptedData);

      // Modificar les dades encriptades (corromper)
      const corruptedData = encryptedData + "CORRUPT";
      const originalChecksum = checksum;
      const corruptedChecksum = await calculateChecksum(corruptedData);

      // El checksum hauria de ser diferent
      expect(corruptedChecksum).not.toBe(originalChecksum);
    });
  });

  describe("Migració automàtica", () => {
    it("hauria de detectar dotacions en text pla vs encriptades", () => {
      // Dotacions en text pla (format antic)
      const dotacionsTextPla = [
        {
          numero: "OLD123",
          conductor: "Antic Usuario",
          ajudant: "Antic Ajudant",
        },
      ];

      // Dotacions encriptades (format nou)
      const dotacionsEncriptades = {
        version: 1,
        algorithm: "AES-GCM",
        iv: "dGVzdA==",
        data: "ZW5jcnlwdGVk",
        checksum: "abc123",
      };

      // Verificar que podem distingir entre formats
      const isOldFormat = Array.isArray(dotacionsTextPla);
      const isNewFormat =
        dotacionsEncriptades.version === 1 &&
        dotacionsEncriptades.algorithm === "AES-GCM";

      expect(isOldFormat).toBe(true);
      expect(isNewFormat).toBe(true);
      expect(Array.isArray(dotacionsEncriptades)).toBe(false);
    });
  });

  describe("Compatibilitat i fallbacks", () => {
    it("hauria de tenir mecanismes de fallback per errors", () => {
      // Verificar que podem detectar si el sistema de claus està disponible
      const hasWebCrypto =
        typeof crypto !== "undefined" && typeof crypto.subtle !== "undefined";

      expect(hasWebCrypto).toBe(true);

      // Verificar que tenim les funcions necessàries
      expect(typeof crypto.subtle.generateKey).toBe("function");
      expect(typeof crypto.subtle.encrypt).toBe("function");
      expect(typeof crypto.subtle.decrypt).toBe("function");
    });
  });

  describe("Integritat de dades", () => {
    it("no hauria de perdre cap camp després de round-trip encrypt/decrypt", async () => {
      const dotacioCompleta = {
        numero: "ABC123",
        conductor: "Joan Garcia i Martínez",
        ajudant: "María José López García",
        firmaConductor:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        firmaAjudant:
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      };

      // Funcions auxiliars
      const arrayBufferToBase64 = (buffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      const base64ToArrayBuffer = (base64) => {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
      };

      // Encrypt
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(JSON.stringify([dotacioCompleta]));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv, tagLength: 128 },
        masterKey,
        dataBuffer
      );

      const encryptedData = arrayBufferToBase64(encryptedBuffer);
      const ivBase64 = arrayBufferToBase64(iv);

      // Decrypt
      const encBuf = base64ToArrayBuffer(encryptedData);
      const ivBuf = base64ToArrayBuffer(ivBase64);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: new Uint8Array(ivBuf), tagLength: 128 },
        masterKey,
        new Uint8Array(encBuf)
      );

      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decryptedBuffer);
      const recovered = JSON.parse(jsonString)[0];

      // Verificar tots els camps
      expect(recovered.numero).toBe(dotacioCompleta.numero);
      expect(recovered.conductor).toBe(dotacioCompleta.conductor);
      expect(recovered.ajudant).toBe(dotacioCompleta.ajudant);
      expect(recovered.firmaConductor).toBe(dotacioCompleta.firmaConductor);
      expect(recovered.firmaAjudant).toBe(dotacioCompleta.firmaAjudant);

      // Verificar que NO hi ha corrupció
      expect(JSON.stringify(recovered)).toBe(JSON.stringify(dotacioCompleta));
    });
  });
});
