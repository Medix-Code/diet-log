/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

if (!Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")) {
  Object.defineProperty(ArrayBuffer.prototype, "resizable", {
    configurable: true,
    enumerable: false,
    get() {
      return false;
    },
  });
}

if (
  typeof SharedArrayBuffer !== "undefined" &&
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

export default defineConfig({
  test: {
    environment: "jsdom", // Use jsdom for DOM access
    globals: true, // Use describe, it, etc. globally
    setupFiles: ["./tests/vitest.setup.js"],
  },
});
