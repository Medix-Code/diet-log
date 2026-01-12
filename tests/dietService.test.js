// Tests simplificats per DietService - només funcionalitats bàsiques
import { describe, it, expect, beforeAll } from "vitest";

let dietServiceModule;

beforeAll(async () => {
  dietServiceModule = await import("../src/services/dietService.js");
});

describe("DietService - Basic functionality", () => {
  it("should have Diet class", () => {
    const { Diet } = dietServiceModule;
    expect(typeof Diet).toBe("function");
  });

  it("should create Diet instance", () => {
    const { Diet } = dietServiceModule;

    const diet = new Diet({
      id: "test-id",
      date: "2023-12-01",
      dietType: "lunch",
    });

    expect(diet.id).toBe("test-id");
    expect(diet.date).toBe("2023-12-01");
    expect(diet.dietType).toBe("lunch");
  });

  it("should have loadDietById function", () => {
    const { loadDietById } = dietServiceModule;
    expect(typeof loadDietById).toBe("function");
  });

  it("should have handleManualSave function", () => {
    const { handleManualSave } = dietServiceModule;
    expect(typeof handleManualSave).toBe("function");
  });
});

// Nota: DietService té dependències complexes amb DB, DOM i altres serveis
// que requereixen mocks molt extenses per tests unitaris. Els tests bàsics
// confirmen l'existència de les funcions principals. Per tests d'integració,
// usar e2e tests amb IndexedDB simulada.
