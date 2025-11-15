/**
 * @file dotacion.simple.test.js
 * @description Tests simples d'encriptació de dotacions
 */

import { describe, it, expect, beforeAll } from "vitest";

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

describe("Encriptació de Dotacions - Tests Simples", () => {
  let masterKey;

  beforeAll(async () => {
    localStorage.clear();
    // Crear una clau mestra de test directament (evitem IndexedDB)
    masterKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  });

  it("✅ Sistema de claus inicialitzat correctament", () => {
    expect(masterKey).toBeTruthy();
    expect(masterKey.type).toBe("secret");
  });

  it("✅ AES-GCM encripta i desencripta correctament", async () => {
    const testData = {
      numero: "ABC123",
      conductor: "Joan Garcia",
      ajudant: "Maria Lopez",
    };

    // Encriptar
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(testData));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      masterKey,
      dataBuffer
    );

    // Les dades encriptades NO haurien de contenir el text original
    const encryptedString = new Uint8Array(encryptedBuffer).toString();
    expect(encryptedString).not.toContain("ABC123");
    expect(encryptedString).not.toContain("Joan Garcia");

    // Desencriptar
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      masterKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBuffer);
    const decryptedData = JSON.parse(decryptedString);

    // Verificar que les dades són idèntiques
    expect(decryptedData).toEqual(testData);
  });

  it("✅ Checksum SHA-256 funciona correctament", async () => {
    const data1 = "test data 123";
    const data2 = "test data 123";
    const data3 = "different data";

    const hash = async (str) => {
      const encoder = new TextEncoder();
      const buffer = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    };

    const hash1 = await hash(data1);
    const hash2 = await hash(data2);
    const hash3 = await hash(data3);

    // Mateixos dades = mateix hash
    expect(hash1).toBe(hash2);

    // Dades diferents = hash diferent
    expect(hash1).not.toBe(hash3);

    // Hash té 64 caràcters (256 bits en hex)
    expect(hash1).toHaveLength(64);
  });

  it("✅ Base64 encoding/decoding funciona", () => {
    const testString = "Test data with special chars: àèìòù €";
    const encoder = new TextEncoder();
    const buffer = encoder.encode(testString);

    // Convertir a Base64
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    // Convertir de Base64
    const binaryDecoded = atob(base64);
    const bytesDecoded = new Uint8Array(binaryDecoded.length);
    for (let i = 0; i < binaryDecoded.length; i++) {
      bytesDecoded[i] = binaryDecoded.charCodeAt(i);
    }

    const decoder = new TextDecoder();
    const decoded = decoder.decode(bytesDecoded);

    expect(decoded).toBe(testString);
  });

  it("✅ Múltiples dotacions encriptades tenen IVs únics", async () => {
    const ivs = [];

    for (let i = 0; i < 10; i++) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ivString = Array.from(iv).join(",");
      ivs.push(ivString);
    }

    // Tots els IVs haurien de ser únics
    const uniqueIVs = new Set(ivs);
    expect(uniqueIVs.size).toBe(10);
  });

  it("✅ Signatures es poden encriptar/desencriptar", async () => {
    const signatureData =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const dotacio = {
      numero: "XYZ789",
      conductor: "Pere Martí",
      ajudant: "Anna Soler",
      firmaConductor: signatureData,
      firmaAjudant: signatureData,
    };

    // Encriptar
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(dotacio));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      masterKey,
      dataBuffer
    );

    // Desencriptar
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      masterKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBuffer);
    const decryptedDotacio = JSON.parse(decryptedString);

    // Verificar que les signatures estan intactes
    expect(decryptedDotacio.firmaConductor).toBe(signatureData);
    expect(decryptedDotacio.firmaAjudant).toBe(signatureData);
    expect(decryptedDotacio.firmaConductor).toHaveLength(signatureData.length);
  });

  it("✅ Caracteres especials catalans es preserven", async () => {
    const dotacio = {
      numero: "CAT123",
      conductor: "Jaume Güell i Vilà",
      ajudant: "Montserrat Núñez García",
    };

    // Round-trip
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(JSON.stringify(dotacio));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      masterKey,
      dataBuffer
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      masterKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    const decryptedString = decoder.decode(decryptedBuffer);
    const decryptedDotacio = JSON.parse(decryptedString);

    // Verificar caràcters especials
    expect(decryptedDotacio.conductor).toBe("Jaume Güell i Vilà");
    expect(decryptedDotacio.ajudant).toBe("Montserrat Núñez García");
  });

  it("✅ Format JSON es preserva completament", async () => {
    const dotacions = [
      {
        numero: "A1",
        conductor: "Test 1",
        ajudant: "Test A",
        firmaConductor: "",
        firmaAjudant: "",
      },
      {
        numero: "B2",
        conductor: "Test 2",
        ajudant: "Test B",
        firmaConductor: "data:test",
        firmaAjudant: "data:test2",
      },
    ];

    const originalJSON = JSON.stringify(dotacions);

    // Encriptar
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(originalJSON);
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      masterKey,
      dataBuffer
    );

    // Desencriptar
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv, tagLength: 128 },
      masterKey,
      encryptedBuffer
    );

    const decoder = new TextDecoder();
    const decryptedJSON = decoder.decode(decryptedBuffer);

    // El JSON hauria de ser idèntic
    expect(decryptedJSON).toBe(originalJSON);

    const parsed = JSON.parse(decryptedJSON);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].numero).toBe("A1");
    expect(parsed[1].firmaConductor).toBe("data:test");
  });
});
