import { indexedDB as fakeIndexedDB, IDBKeyRange } from "fake-indexeddb";
import { webcrypto } from "node:crypto";

const g = globalThis;

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
// 🔐 Web Crypto API disponible en entorns Node
// ============================================
if (!g.crypto || !g.crypto.subtle) {
  Object.defineProperty(g, "crypto", {
    value: webcrypto,
    writable: false,
    configurable: true,
  });
}

// Mock IndexedDB
if (!g.indexedDB) {
  Object.defineProperty(g, "indexedDB", {
    value: fakeIndexedDB,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(g, "IDBKeyRange", {
    value: IDBKeyRange,
    writable: true,
    configurable: true,
  });
}

// Mock navigator
if (!g.navigator.userAgent) {
  Object.defineProperty(g.navigator, "userAgent", {
    value: "Mozilla/5.0 Test Browser",
    writable: true,
    configurable: true,
  });
}
if (!g.navigator.language) {
  Object.defineProperty(g.navigator, "language", {
    value: "ca-ES",
    writable: true,
    configurable: true,
  });
}
if (!g.navigator.hardwareConcurrency) {
  Object.defineProperty(g.navigator, "hardwareConcurrency", {
    value: 8,
    writable: true,
    configurable: true,
  });
}

// Mock screen
if (!g.screen) {
  Object.defineProperty(g, "screen", {
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
if (typeof g.atob === "undefined") {
  g.atob = (str) => Buffer.from(str, "base64").toString("binary");
}
if (typeof g.btoa === "undefined") {
  g.btoa = (str) => Buffer.from(str, "binary").toString("base64");
}
