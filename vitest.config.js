/// <reference types="vitest" />
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom", // Use jsdom for DOM access
    globals: true, // Use describe, it, etc. globally
  },
});
