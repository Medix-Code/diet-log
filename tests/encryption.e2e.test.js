/**
 * Tests E2E per encriptació amb Web Crypto API REAL
 * Aquests tests validen que l'encriptació funciona correctament amb l'API real
 * NO usen mocks - validen el comportament real de la criptografia
 */

import { describe, it, expect, beforeEach } from "vitest";
import cryptoManager from "../src/utils/cryptoManager.js";

describe("Encriptació E2E - Web Crypto API REAL", () => {
  let masterKey;

  beforeEach(async () => {
    // Generar clau mestra DIRECTAMENT amb Web Crypto API (sense keyManager)
    masterKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false, // No exportable (més segur)
      ["encrypt", "decrypt"]
    );
  });

  describe("Round-trip: Encriptar → Desencriptar", () => {
    it("hauria de preservar TOTES les dades en un round-trip complet", async () => {
      // Dieta original amb estructura REAL de l'aplicació
      const originalDiet = {
        id: "e2e-test-001",
        date: "2025-11-01",
        dietType: "normal",
        serviceType: "TSU",
        // Camps SENSIBLES (s'encripten)
        person1: "Joan Garcia Pérez",
        person2: "Maria López",
        vehicleNumber: "B-1234-XY",
        signatureConductor: "data:image/png;base64,iVBORw0KGgoAAAANS...",
        signatureAjudant: "data:image/png;base64,ABC123...",
        services: [
          {
            id: "srv-1",
            type: "esmorzar",
            hour: "08:00",
            // SENSITIVE_SERVICE_FIELDS
            serviceNumber: "001",
            origin: "Barcelona Centre",
            destination: "Hospital",
            notes: "Sense gluten, vegetarià",
          },
          {
            id: "srv-2",
            type: "dinar",
            hour: "13:00",
            serviceNumber: "002",
            origin: "Hospital",
            destination: "Domicili",
            notes: "Diabètic",
          },
        ],
      };

      // Encriptar
      const encrypted = await cryptoManager.encryptDiet(
        originalDiet,
        masterKey
      );

      // Validar estructura encriptada
      expect(encrypted).toHaveProperty("id");
      expect(encrypted).toHaveProperty("date");
      expect(encrypted).toHaveProperty("encryptedData");
      expect(encrypted).toHaveProperty("encryption");
      expect(encrypted.encryption).toHaveProperty("iv");
      expect(encrypted).toHaveProperty("checksum");

      // Desencriptar
      const decrypted = await cryptoManager.decryptDiet(encrypted, masterKey);

      // Validar que TOTES les dades es preserven
      expect(decrypted.id).toBe(originalDiet.id);
      expect(decrypted.date).toBe(originalDiet.date);
      expect(decrypted.dietType).toBe("normal");
      expect(decrypted.serviceType).toBe("TSU");

      // Camps sensibles generals
      expect(decrypted.person1).toBe("Joan Garcia Pérez");
      expect(decrypted.person2).toBe("Maria López");
      expect(decrypted.vehicleNumber).toBe("B-1234-XY");
      expect(decrypted.signatureConductor).toBe(
        "data:image/png;base64,iVBORw0KGgoAAAANS..."
      );
      expect(decrypted.signatureAjudant).toBe(
        "data:image/png;base64,ABC123..."
      );

      // Services amb camps sensibles
      expect(decrypted.services).toHaveLength(2);
      expect(decrypted.services[0]).toEqual({
        id: "srv-1",
        type: "esmorzar",
        hour: "08:00",
        serviceNumber: "001",
        origin: "Barcelona Centre",
        destination: "Hospital",
        notes: "Sense gluten, vegetarià",
      });
      expect(decrypted.services[1]).toEqual({
        id: "srv-2",
        type: "dinar",
        hour: "13:00",
        serviceNumber: "002",
        origin: "Hospital",
        destination: "Domicili",
        notes: "Diabètic",
      });
    });

    it("hauria de funcionar amb dietes sense serveis", async () => {
      const diet = {
        id: "e2e-test-002",
        date: "2025-11-02",
        dietType: "diabètic",
        serviceType: "TSU",
        person1: "Maria López",
        person2: "",
        vehicleNumber: "B-5678-AB",
        services: [],
      };

      const encrypted = await cryptoManager.encryptDiet(diet, masterKey);
      const decrypted = await cryptoManager.decryptDiet(encrypted, masterKey);

      // Validar camps clau
      expect(decrypted.id).toBe(diet.id);
      expect(decrypted.date).toBe(diet.date);
      expect(decrypted.dietType).toBe("diabètic");
      expect(decrypted.serviceType).toBe("TSU");
      expect(decrypted.person1).toBe("Maria López");
      expect(decrypted.person2).toBe("");
      expect(decrypted.vehicleNumber).toBe("B-5678-AB");
      expect(decrypted.services).toEqual([]);
    });

    it("hauria de funcionar amb camps opcionals", async () => {
      const diet = {
        id: "e2e-test-003",
        date: "2025-11-03",
        dietType: "normal",
        serviceType: "TSU",
        person1: "Pere Martínez",
        vehicleNumber: "B-9999-ZZ",
        services: [
          {
            id: "srv-1",
            type: "dinar",
            hour: "13:00",
            serviceNumber: "003",
            origin: "Tarragona",
            destination: "Hospital Sant Pau",
          },
        ],
        // Sense person2, signatures, notes als serveis
      };

      const encrypted = await cryptoManager.encryptDiet(diet, masterKey);
      const decrypted = await cryptoManager.decryptDiet(encrypted, masterKey);

      expect(decrypted.id).toBe(diet.id);
      expect(decrypted.date).toBe(diet.date);
      expect(decrypted.person1).toBe("Pere Martínez");
      expect(decrypted.vehicleNumber).toBe("B-9999-ZZ");
      expect(decrypted.services).toEqual([
        {
          id: "srv-1",
          type: "dinar",
          hour: "13:00",
          serviceNumber: "003",
          origin: "Tarragona",
          destination: "Hospital Sant Pau",
        },
      ]);
    });

    it("hauria de funcionar amb caràcters especials i unicode", async () => {
      const diet = {
        id: "e2e-test-004",
        date: "2025-11-04",
        dietType: "normal",
        serviceType: "TSU",
        person1: "José María Núñez Álvarez",
        person2: "François Müller",
        vehicleNumber: "V-àèéíòóú-😀",
        services: [
          {
            id: "srv-1",
            type: "esmorzar",
            hour: "08:00",
            serviceNumber: "004",
            origin: "València",
            destination: "Zürich",
            notes: "Àèéíòóú ñ ç – € 😀 «»",
          },
        ],
      };

      const encrypted = await cryptoManager.encryptDiet(diet, masterKey);
      const decrypted = await cryptoManager.decryptDiet(encrypted, masterKey);

      expect(decrypted.id).toBe(diet.id);
      expect(decrypted.person1).toBe("José María Núñez Álvarez");
      expect(decrypted.person2).toBe("François Müller");
      expect(decrypted.vehicleNumber).toBe("V-àèéíòóú-😀");
      expect(decrypted.services[0].origin).toBe("València");
      expect(decrypted.services[0].destination).toBe("Zürich");
      expect(decrypted.services[0].notes).toBe("Àèéíòóú ñ ç – € 😀 «»");
    });
  });

  describe("Seguretat - IVs únics", () => {
    it("hauria de generar IVs DIFERENTS per cada encriptació", async () => {
      const diet = {
        id: "e2e-test-005",
        date: "2025-11-05",
        firstName: "Test",
        lastName: "User",
        dni: "12345678X",
        location: "Test",
        services: ["dinar"],
      };

      // Encriptar 10 vegades la mateixa dieta
      const encryptions = await Promise.all(
        Array(10)
          .fill(null)
          .map(() => cryptoManager.encryptDiet(diet, masterKey))
      );

      // Extreure tots els IVs
      const ivs = encryptions.map((e) => e.encryption.iv);

      // Validar que TOTS són diferents
      const uniqueIvs = new Set(ivs);
      expect(uniqueIvs.size).toBe(10); // 10 IVs únics
    });

    it("dietes encriptades amb el mateix contingut haurien de ser DIFERENTS", async () => {
      const diet = {
        id: "e2e-test-006",
        date: "2025-11-06",
        firstName: "Test",
        lastName: "User",
        dni: "12345678X",
        location: "Test",
        services: ["dinar"],
      };

      const encrypted1 = await cryptoManager.encryptDiet(diet, masterKey);
      const encrypted2 = await cryptoManager.encryptDiet(diet, masterKey);

      // IVs diferents
      expect(encrypted1.encryption.iv).not.toBe(encrypted2.encryption.iv);

      // Dades encriptades diferents
      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);

      // Checksums diferents
      expect(encrypted1.checksum).not.toBe(encrypted2.checksum);

      // PERÒ ambdues desencripten a la mateixa dada original (ignorant timestamps)
      const decrypted1 = await cryptoManager.decryptDiet(encrypted1, masterKey);
      const decrypted2 = await cryptoManager.decryptDiet(encrypted2, masterKey);
      expect(decrypted1.id).toBe(decrypted2.id);
      expect(decrypted1.firstName).toBe(decrypted2.firstName);
      expect(decrypted1.dni).toBe(decrypted2.dni);
    });
  });

  describe("Seguretat - Claus incorrectes", () => {
    it("NO hauria de desencriptar amb una clau DIFERENT", async () => {
      const diet = {
        id: "e2e-test-007",
        date: "2025-11-07",
        firstName: "Test",
        lastName: "User",
        dni: "12345678X",
        location: "Test",
        services: ["dinar"],
      };

      // Encriptar amb masterKey
      const encrypted = await cryptoManager.encryptDiet(diet, masterKey);

      // Intentar desencriptar amb una ALTRA clau
      const wrongKey = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );

      // Hauria de fallar
      await expect(
        cryptoManager.decryptDiet(encrypted, wrongKey)
      ).rejects.toThrow();
    });
  });

  describe("Seguretat - Integritat de dades", () => {
    it("hauria de detectar MANIPULACIÓ de dades encriptades", async () => {
      const diet = {
        id: "e2e-test-008",
        date: "2025-11-08",
        firstName: "Test",
        lastName: "User",
        dni: "12345678X",
        location: "Test",
        services: ["dinar"],
      };

      const encrypted = await cryptoManager.encryptDiet(diet, masterKey);

      // Modificar les dades encriptades
      const tampered = {
        ...encrypted,
        encryptedData: encrypted.encryptedData.slice(0, -10) + "MANIPULAT",
      };

      // Hauria de fallar en desencriptar
      await expect(
        cryptoManager.decryptDiet(tampered, masterKey)
      ).rejects.toThrow();
    });

    it("hauria de detectar MANIPULACIÓ del IV", async () => {
      const diet = {
        id: "e2e-test-009",
        date: "2025-11-09",
        firstName: "Test",
        lastName: "User",
        dni: "12345678X",
        location: "Test",
        services: ["dinar"],
      };

      const encrypted = await cryptoManager.encryptDiet(diet, masterKey);

      // Modificar el IV
      const tampered = {
        ...encrypted,
        encryption: {
          ...encrypted.encryption,
          iv: "AAECAwQFBgcICQoLDA0ODw==", // IV manipulat
        },
      };

      // Hauria de fallar en desencriptar
      await expect(
        cryptoManager.decryptDiet(tampered, masterKey)
      ).rejects.toThrow();
    });
  });

  describe("Performance", () => {
    it("hauria d'encriptar i desencriptar 10 dietes en menys de 1 segon", async () => {
      const diets = Array(10)
        .fill(null)
        .map((_, i) => ({
          id: `perf-test-${i}`,
          date: "2025-11-10",
          firstName: `User${i}`,
          lastName: `Test${i}`,
          dni: `${i}${i}${i}${i}${i}${i}${i}${i}X`,
          location: "Test",
          services: ["esmorzar", "dinar", "sopar"],
          observations: "Test performance amb dades més grans ".repeat(10),
        }));

      const start = performance.now();

      // Encriptar totes
      const encrypted = await Promise.all(
        diets.map((d) => cryptoManager.encryptDiet(d, masterKey))
      );

      // Desencriptar totes
      const decrypted = await Promise.all(
        encrypted.map((e) => cryptoManager.decryptDiet(e, masterKey))
      );

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000); // Menys de 1 segon
      expect(decrypted).toHaveLength(10);
      // Validar que les dades es preserven
      expect(decrypted[0].id).toBe("perf-test-0");
      expect(decrypted[1].id).toBe("perf-test-1");
    });
  });

  describe("Validació de format", () => {
    it("encryptedData hauria de ser Base64 vàlid", async () => {
      const diet = {
        id: "format-test-001",
        date: "2025-11-11",
        firstName: "Test",
        lastName: "User",
        dni: "12345678X",
        location: "Test",
        services: ["dinar"],
      };

      const encrypted = await cryptoManager.encryptDiet(diet, masterKey);

      // Validar que és Base64
      expect(encrypted.encryptedData).toMatch(/^[A-Za-z0-9+/]+=*$/);

      // Hauria de poder-se decodificar
      const decoded = atob(encrypted.encryptedData);
      expect(decoded.length).toBeGreaterThan(0);
    });

    it("IV hauria de ser Base64 vàlid", async () => {
      const diet = {
        id: "format-test-002",
        date: "2025-11-12",
        firstName: "Test",
        lastName: "User",
        dni: "12345678X",
        location: "Test",
        services: ["dinar"],
      };

      const encrypted = await cryptoManager.encryptDiet(diet, masterKey);

      // Validar que és Base64
      expect(encrypted.encryption.iv).toMatch(/^[A-Za-z0-9+/]+=*$/);

      // IV d'AES-GCM hauria de ser 12 bytes (16 caràcters Base64)
      const decoded = atob(encrypted.encryption.iv);
      expect(decoded.length).toBe(12);
    });

    it("checksum hauria de ser diferent per dades diferents", async () => {
      const diet1 = {
        id: "checksum-test-001",
        date: "2025-11-13",
        firstName: "User1",
        lastName: "Test",
        dni: "11111111A",
        location: "Test",
        services: ["dinar"],
      };

      const diet2 = {
        id: "checksum-test-002",
        date: "2025-11-13",
        firstName: "User2",
        lastName: "Test",
        dni: "22222222B",
        location: "Test",
        services: ["dinar"],
      };

      const encrypted1 = await cryptoManager.encryptDiet(diet1, masterKey);
      const encrypted2 = await cryptoManager.encryptDiet(diet2, masterKey);

      // Checksums diferents perquè les dades són diferents
      expect(encrypted1.checksum).not.toBe(encrypted2.checksum);
    });
  });
});
