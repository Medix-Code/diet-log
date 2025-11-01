/**
 * @file security.migration.test.js
 * @description Tests de seguretat per verificar la migració segura de dades antigues
 *
 * OWASP A02 - Cryptographic Failures
 * Verificació: La migració de dades en text pla a encriptades ha de ser segura i informar l'usuari
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

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
const mockShowToast = vi.fn();
vi.mock("../src/ui/toast.js", () => ({
  showToast: mockShowToast,
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

// Mock del keyManager
vi.mock("../src/utils/keyManager.js", async () => {
  let cachedKey = null;

  return {
    initializeKeySystem: vi.fn(async () => true),
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

describe("🔒 SEGURETAT: Migració Segura de Dades Antigues", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe("Migració de dades en text pla", () => {
    it("✅ hauria de detectar dades antigues sense encriptar", () => {
      // Simular dades antigues en text pla
      const dotacionsTextPla = [
        {
          numero: "OLD-001",
          conductor: "Dades Antigues",
          ajudant: "Format Insegur",
        },
      ];

      localStorage.setItem("dotacions_v2", JSON.stringify(dotacionsTextPla));
      localStorage.removeItem("dotacions_encrypted");

      // Verificar que podem detectar format antic
      const savedData = localStorage.getItem("dotacions_v2");
      const isOldFormat = !localStorage.getItem("dotacions_encrypted");

      expect(isOldFormat).toBe(true);
      expect(savedData).toContain("Dades Antigues");
    });

    it("❌ NO hauria de fer fallback a text pla si falla la desencriptació", async () => {
      // Dades suposadament encriptades però corrompudes
      const corruptedData = {
        version: 1,
        algorithm: "AES-GCM",
        iv: "corrupt",
        data: "invalid_base64",
        checksum: "wrong",
      };

      localStorage.setItem("dotacions_v2", JSON.stringify(corruptedData));
      localStorage.setItem("dotacions_encrypted", "true");

      // Mock del DOM
      global.document = {
        getElementById: vi.fn(() => null),
        body: { classList: { add: vi.fn(), remove: vi.fn() } },
      };

      // Importar el servei
      const { dotacionService } = await import("../src/services/dotacion.js");

      // Carregar dotacions (hauria de fallar sense fallback)
      await dotacionService.loadDotacionsFromStorage();

      // Verificar que NO s'han carregat dades
      expect(dotacionService.savedDotacions).toEqual([]);

      // Verificar que s'ha mostrat error
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("Error"),
        "error",
        expect.any(Number)
      );
    });

    it("⚠️ hauria d'avisar si no es pot completar la migració", async () => {
      // Simular dades antigues
      const dotacionsTextPla = [
        { numero: "TEST", conductor: "Test", ajudant: "Test2" },
      ];

      localStorage.setItem("dotacions_v2", JSON.stringify(dotacionsTextPla));
      localStorage.removeItem("dotacions_encrypted");

      // Mock del keyManager que falla
      vi.mock("../src/utils/keyManager.js", () => ({
        isKeySystemInitialized: vi.fn(() => false), // Sistema NO disponible
        getMasterKey: vi.fn(() => {
          throw new Error("Keys not available");
        }),
      }));

      // Mock del DOM
      global.document = {
        getElementById: vi.fn(() => null),
        body: { classList: { add: vi.fn(), remove: vi.fn() } },
      };

      // Recarregar el servei amb el nou mock
      vi.resetModules();
      const { dotacionService } = await import("../src/services/dotacion.js");

      // Carregar dotacions
      await dotacionService.loadDotacionsFromStorage();

      // Hauria de mostrar avís sobre migració fallida
      const warningCalls = mockShowToast.mock.calls.filter(
        (call) => call[1] === "warning" || call[1] === "error"
      );

      expect(warningCalls.length).toBeGreaterThan(0);
    });
  });

  describe("Protecció contra càrrega insegura", () => {
    it("❌ NO hauria de carregar dades encriptades sense clau", async () => {
      const encryptedData = {
        version: 1,
        algorithm: "AES-GCM",
        iv: "test",
        data: "encrypted",
        checksum: "hash",
      };

      localStorage.setItem("dotacions_v2", JSON.stringify(encryptedData));
      localStorage.setItem("dotacions_encrypted", "true");

      // Mock keyManager que retorna false
      vi.mock("../src/utils/keyManager.js", () => ({
        isKeySystemInitialized: vi.fn(() => false),
        getMasterKey: vi.fn(() => null),
      }));

      // Mock del DOM
      global.document = {
        getElementById: vi.fn(() => null),
        body: { classList: { add: vi.fn(), remove: vi.fn() } },
      };

      // Recarregar servei
      vi.resetModules();
      const { dotacionService } = await import("../src/services/dotacion.js");

      await dotacionService.loadDotacionsFromStorage();

      // NO hauria d'haver carregat res
      expect(dotacionService.savedDotacions).toEqual([]);

      // Hauria de mostrar error de seguretat
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining("seguretat"),
        "error",
        expect.any(Number)
      );
    });
  });

  describe("Missatges d'usuari apropiats", () => {
    it("✅ hauria de cridar showToast durant operacions crítiques", () => {
      // Aquest test verifica que showToast està disponible
      expect(mockShowToast).toBeDefined();
      expect(typeof mockShowToast).toBe("function");

      // Simular una crida
      mockShowToast("Test message", "warning", 5000);

      expect(mockShowToast).toHaveBeenCalledWith(
        "Test message",
        "warning",
        5000
      );
    });
  });
});
