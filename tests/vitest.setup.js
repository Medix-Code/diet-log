import { vi } from "vitest";
import { indexedDB as fakeIndexedDB, IDBKeyRange } from "fake-indexeddb";

// Polyfills necessaris per a jsdom 27 amb Node 18
if (!Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")) {
  Object.defineProperty(ArrayBuffer.prototype, "resizable", {
    configurable: true,
    enumerable: false,
    get() {
      return false;
    },
  });
}

if (typeof SharedArrayBuffer !== "undefined") {
  if (
    !Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "growable")
  ) {
    Object.defineProperty(SharedArrayBuffer.prototype, "growable", {
      configurable: true,
      enumerable: false,
      get() {
        return false;
      },
    });
  }
}

// ============================================
// 🔐 MOCKS GLOBALS PER TESTS D'ENCRIPTACIÓ
// ============================================

// Mock Web Crypto API
if (!global.crypto) {
  Object.defineProperty(global, "crypto", {
    value: {
      subtle: {
        generateKey: vi.fn().mockResolvedValue({
          type: "secret",
          algorithm: { name: "AES-GCM", length: 256 },
        }),
        importKey: vi.fn().mockResolvedValue("mock-imported-key"),
        exportKey: vi
          .fn()
          .mockResolvedValue(new Uint8Array(32).fill(42).buffer),
        encrypt: vi.fn().mockImplementation((algo, key, data) => {
          const result = new Uint8Array(data.byteLength);
          const view = new Uint8Array(data);
          for (let i = 0; i < view.length; i++) {
            result[i] = view[i] ^ 42;
          }
          return Promise.resolve(result.buffer);
        }),
        decrypt: vi.fn().mockImplementation((algo, key, data) => {
          const result = new Uint8Array(data.byteLength);
          const view = new Uint8Array(data);
          for (let i = 0; i < view.length; i++) {
            result[i] = view[i] ^ 42;
          }
          return Promise.resolve(result.buffer);
        }),
        digest: vi.fn().mockImplementation((algo, data) => {
          const hash = new Uint8Array(32);
          const view = new Uint8Array(data);
          let sum = 0;
          for (let i = 0; i < view.length; i++) {
            sum += view[i];
          }
          hash.fill(sum % 256);
          return Promise.resolve(hash.buffer);
        }),
        wrapKey: vi.fn().mockResolvedValue(new Uint8Array(64).fill(99).buffer),
        unwrapKey: vi.fn().mockResolvedValue({
          type: "secret",
          algorithm: { name: "AES-GCM" },
        }),
        deriveKey: vi.fn().mockResolvedValue("mock-derived-key"),
      },
      getRandomValues: vi.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
    },
    writable: true,
    configurable: true,
  });
}

// Mock IndexedDB
if (!global.indexedDB) {
  Object.defineProperty(global, "indexedDB", {
    value: fakeIndexedDB,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(global, "IDBKeyRange", {
    value: IDBKeyRange,
    writable: true,
    configurable: true,
  });
}

// Mock navigator
if (!global.navigator.userAgent) {
  Object.defineProperty(global.navigator, "userAgent", {
    value: "Mozilla/5.0 Test Browser",
    writable: true,
    configurable: true,
  });
}
if (!global.navigator.language) {
  Object.defineProperty(global.navigator, "language", {
    value: "ca-ES",
    writable: true,
    configurable: true,
  });
}
if (!global.navigator.hardwareConcurrency) {
  Object.defineProperty(global.navigator, "hardwareConcurrency", {
    value: 8,
    writable: true,
    configurable: true,
  });
}

// Mock screen
if (!global.screen) {
  Object.defineProperty(global, "screen", {
    value: {
      width: 1920,
      height: 1080,
      colorDepth: 24,
    },
    writable: true,
    configurable: true,
  });
}

// Mock atob/btoa para Node.js (no son polyfills nativos en vitest)
if (typeof global.atob === "undefined") {
  global.atob = (str) => Buffer.from(str, "base64").toString("binary");
}
if (typeof global.btoa === "undefined") {
  global.btoa = (str) => Buffer.from(str, "binary").toString("base64");
}
