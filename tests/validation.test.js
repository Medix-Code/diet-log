import { describe, it, expect } from "vitest";
import { sanitizeText } from "../src/utils/validation.js";

describe("validation utils", () => {
  describe("sanitizeText", () => {
    it("should remove leading and trailing whitespace", () => {
      expect(sanitizeText("  hello world  ")).toBe("hello world");
    });

    it("should escape HTML characters", () => {
      expect(sanitizeText("<script>")).toBe("script");
    });

    it("should handle null input", () => {
      expect(sanitizeText(null)).toBe("");
    });

    it("should handle undefined input", () => {
      expect(sanitizeText(undefined)).toBe("");
    });

    it("should handle non-string input", () => {
      expect(sanitizeText(123)).toBe("");
    });
  });
});
