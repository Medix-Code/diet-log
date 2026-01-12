// tests/trash.test.js - Tests per al sistema de paperera

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  moveDietToTrash,
  restoreDietFromTrash,
  deleteDietFromTrashPermanently,
  getAllDeletedDiets,
  cleanupOldDeletedDiets,
  emptyTrash,
  addDiet,
  getDiet,
  openDatabase,
  closeDatabase,
} from "../src/db/indexedDbDietRepository.js";

describe("Sistema de Paperera", () => {
  beforeEach(async () => {
    await openDatabase();
  });

  afterEach(async () => {
    // Neteja després de cada test
    await emptyTrash();
    closeDatabase();
  });

  describe("moveDietToTrash", () => {
    it("hauria de moure una dieta a la paperera", async () => {
      // Crear una dieta
      const diet = {
        id: "test-diet-1",
        date: "2025-01-10",
        dietType: 1,
        name: "Test Diet",
      };

      await addDiet(diet);

      // Moure a paperera
      await moveDietToTrash(diet);

      // Verificar que ja no està a dietes actives
      const activeDiet = await getDiet(diet.id);
      expect(activeDiet).toBeUndefined();

      // Verificar que està a la paperera
      const deletedDiets = await getAllDeletedDiets();
      expect(deletedDiets).toHaveLength(1);
      expect(deletedDiets[0].id).toBe(diet.id);
      expect(deletedDiets[0].deletedAt).toBeDefined();
    });

    it("hauria d'afegir timestamp deletedAt", async () => {
      const diet = {
        id: "test-diet-2",
        date: "2025-01-10",
        dietType: 2,
      };

      await addDiet(diet);
      await moveDietToTrash(diet);

      const deletedDiets = await getAllDeletedDiets();
      const deletedDiet = deletedDiets[0];

      expect(deletedDiet.deletedAt).toBeDefined();
      expect(typeof deletedDiet.deletedAt).toBe("string");
      expect(new Date(deletedDiet.deletedAt).getTime()).toBeGreaterThan(0);
    });
  });

  describe("restoreDietFromTrash", () => {
    it("hauria de restaurar una dieta de la paperera", async () => {
      const diet = {
        id: "test-diet-3",
        date: "2025-01-10",
        dietType: 1,
        name: "Restored Diet",
      };

      await addDiet(diet);
      await moveDietToTrash(diet);

      // Restaurar
      const restored = await restoreDietFromTrash(diet.id);

      // Verificar que està de tornada a dietes actives
      const activeDiet = await getDiet(diet.id);
      expect(activeDiet).toBeDefined();
      expect(activeDiet.name).toBe("Restored Diet");

      // Verificar que ja no està a la paperera
      const deletedDiets = await getAllDeletedDiets();
      expect(deletedDiets).toHaveLength(0);

      // Verificar que no té deletedAt
      expect(restored.deletedAt).toBeUndefined();
    });

    it("hauria de llançar error si la dieta no existeix a la paperera", async () => {
      await expect(restoreDietFromTrash("non-existent")).rejects.toThrow();
    });
  });

  describe("deleteDietFromTrashPermanently", () => {
    it("hauria d'eliminar permanentment una dieta de la paperera", async () => {
      const diet = {
        id: "test-diet-4",
        date: "2025-01-10",
        dietType: 3,
      };

      await addDiet(diet);
      await moveDietToTrash(diet);

      // Eliminar permanentment
      await deleteDietFromTrashPermanently(diet.id);

      // Verificar que ja no està a la paperera
      const deletedDiets = await getAllDeletedDiets();
      expect(deletedDiets).toHaveLength(0);

      // Verificar que tampoc està a dietes actives
      const activeDiet = await getDiet(diet.id);
      expect(activeDiet).toBeUndefined();
    });
  });

  describe("getAllDeletedDiets", () => {
    it("hauria de retornar totes les dietes eliminades", async () => {
      const diets = [
        { id: "test-diet-5", date: "2025-01-10", dietType: 1 },
        { id: "test-diet-6", date: "2025-01-11", dietType: 2 },
        { id: "test-diet-7", date: "2025-01-12", dietType: 3 },
      ];

      for (const diet of diets) {
        await addDiet(diet);
        await moveDietToTrash(diet);
      }

      const deletedDiets = await getAllDeletedDiets();
      expect(deletedDiets).toHaveLength(3);
    });

    it("hauria de retornar array buit si no hi ha dietes eliminades", async () => {
      const deletedDiets = await getAllDeletedDiets();
      expect(deletedDiets).toHaveLength(0);
    });
  });

  describe("cleanupOldDeletedDiets", () => {
    it("hauria d'eliminar dietes més antigues que X dies", async () => {
      const oldDiet = {
        id: "old-diet",
        date: "2024-01-01",
        dietType: 1,
      };

      const recentDiet = {
        id: "recent-diet",
        date: "2025-01-10",
        dietType: 2,
      };

      // Afegir dietes
      await addDiet(oldDiet);
      await addDiet(recentDiet);

      // Moure a paperera
      await moveDietToTrash(oldDiet);
      await moveDietToTrash(recentDiet);

      // Modificar manualment la data de deletedAt de la dieta antiga
      // (simulant que es va eliminar fa 40 dies)
      const deletedDiets = await getAllDeletedDiets();
      const oldDeletedDiet = deletedDiets.find((d) => d.id === "old-diet");
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);
      oldDeletedDiet.deletedAt = oldDate.toISOString();

      // Re-guardar amb la data antiga
      const { openDatabase, getTx, waitTx } = await import(
        "../src/db/indexedDbDietRepository.js"
      );
      const db = await openDatabase();
      const tx = db.transaction(["deleted_diets"], "readwrite");
      const store = tx.objectStore("deleted_diets");
      store.put(oldDeletedDiet);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });

      // Executar cleanup (mantenir 30 dies)
      const deletedCount = await cleanupOldDeletedDiets(30);

      // Verificar que només s'ha eliminat la dieta antiga
      expect(deletedCount).toBe(1);

      const remainingDiets = await getAllDeletedDiets();
      expect(remainingDiets).toHaveLength(1);
      expect(remainingDiets[0].id).toBe("recent-diet");
    });
  });

  describe("emptyTrash", () => {
    it("hauria de buidar completament la paperera", async () => {
      const diets = [
        { id: "test-diet-8", date: "2025-01-10", dietType: 1 },
        { id: "test-diet-9", date: "2025-01-11", dietType: 2 },
        { id: "test-diet-10", date: "2025-01-12", dietType: 3 },
      ];

      for (const diet of diets) {
        await addDiet(diet);
        await moveDietToTrash(diet);
      }

      await emptyTrash();

      const deletedDiets = await getAllDeletedDiets();
      expect(deletedDiets).toHaveLength(0);
    });
  });
});
