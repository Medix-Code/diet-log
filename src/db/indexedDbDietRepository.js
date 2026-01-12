import {
  DB_NAME,
  DB_VERSION,
  STORE_NAMES,
  INDEXES,
} from "./dbConfig.js";

// Gestió de dietes amb IndexedDB

// Constants de la base de dades
const STORE_NAME = STORE_NAMES.DIETAS;
const INDEX_DATE = INDEXES.DIET_DATE;
const DOTACIONS_STORE = STORE_NAMES.DOTACIONS;
const DELETED_DIETS_STORE = STORE_NAMES.DELETED_DIETS;

let dbInstance = null;

// Funcions internes per connexió
function openInternal() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;
      let store;

      // V1: Crear objectStore de dietes
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        // Afegir índex si és nou
        store.createIndex(INDEX_DATE, "date", { unique: false });
      } else {
        store = event.target.transaction.objectStore(STORE_NAME);
        // Afegir índex si no existeix
        if (store && !store.indexNames.contains(INDEX_DATE)) {
          store.createIndex(INDEX_DATE, "date", { unique: false });
        }
      }

      // V2: Crear objectStore de dotacions (si no existeix)
      if (oldVersion < 2 && !db.objectStoreNames.contains(DOTACIONS_STORE)) {
        const dotacionsStore = db.createObjectStore(DOTACIONS_STORE, {
          keyPath: "id",
        });
        dotacionsStore.createIndex(INDEXES.DOTACIONS_TIMESTAMP, "timestamp", {
          unique: false,
        });
      }

      // V3: Crear objectStore de dietes eliminades
      if (oldVersion < 3 && !db.objectStoreNames.contains(DELETED_DIETS_STORE)) {
        const deletedStore = db.createObjectStore(DELETED_DIETS_STORE, {
          keyPath: "id",
        });
        deletedStore.createIndex(
          INDEXES.DELETED_DIETS_DELETED_AT,
          "deletedAt",
          { unique: false }
        );
        deletedStore.createIndex(
          INDEXES.DELETED_DIETS_TYPE,
          "dietType",
          { unique: false }
        );
        deletedStore.createIndex(
          INDEXES.DELETED_DIETS_DATE,
          "date",
          { unique: false }
        );
      }
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;
      dbInstance.onclose = () => (dbInstance = null);
      dbInstance.onerror = () => (dbInstance = null);
      dbInstance.onversionchange = () => dbInstance.close();
      resolve(dbInstance);
    };

    request.onerror = (e) => reject(e.target.error);
    request.onblocked = () =>
      reject(new Error("IndexedDB bloquejat per una altra pestanya"));
  });
}

async function getTx(mode = "readonly", stores = STORE_NAME) {
  const db = dbInstance ?? (dbInstance = await openInternal());
  const storeList = Array.isArray(stores) ? stores : [stores];
  return db.transaction(storeList, mode);
}

function wrap(req, msg) {
  return new Promise((res, rej) => {
    req.onsuccess = (e) => res(e.target.result);
    req.onerror = (e) => rej(new Error(`${msg}: ${e.target.error}`));
  });
}

function waitTx(tx) {
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

// Afegeix dieta nova a IndexedDB
export async function addDiet(diet) {
  try {
    const tx = await getTx("readwrite");
    wrap(tx.objectStore(STORE_NAME).add(diet), "No s'ha pogut afegir");
    await waitTx(tx);
    return diet.id;
  } catch (error) {
    if (
      error.name === "QuotaExceededError" ||
      error.message?.includes("Quota")
    ) {
      throw new Error(
        "No hi ha espai suficient a l'emmagatzematge local. Elimina antigues dietes per alliberar espai."
      );
    }
    throw error;
  }
}

/**
 * Actualitza una dieta existent a IndexedDB.
 * Gestiona errors de quota en cas de que no hi hagi espai.
 * @param {string|Diet} idOrDiet - ID de la dieta o objecte Diet complet
 * @param {Diet} [dietData] - Dades de la dieta (si el primer paràmetre és un ID)
 * @returns {string} - ID de la dieta actualitzada
 * @throws {Error} Quan falla l'operació (inclòs quota exceeded)
 */
export async function updateDiet(idOrDiet, dietData) {
  try {
    // Suportar ambdós formats:
    // updateDiet(diet) - format antic
    // updateDiet(id, diet) - format nou per migració
    let diet;
    if (typeof idOrDiet === "string" && dietData) {
      diet = { ...dietData, id: idOrDiet };
    } else {
      diet = idOrDiet;
    }

    const tx = await getTx("readwrite");
    wrap(tx.objectStore(STORE_NAME).put(diet), "No s'ha pogut actualitzar");
    await waitTx(tx);
    return diet.id;
  } catch (error) {
    if (
      error.name === "QuotaExceededError" ||
      error.message?.includes("Quota")
    ) {
      throw new Error(
        "No hi ha espai suficient a l'emmagatzematge local. Elimina antigues dietes per alliberar espai."
      );
    }
    throw error;
  }
}

/**
 * Obté una dieta per ID d'IndexedDB.
 * @param {string} id - ID de la dieta a recuperar
 * @returns {Diet|undefined} - La dieta trobada o undefined si no existeix
 */
export async function getDiet(id) {
  if (!id) return undefined;
  const tx = await getTx();
  return wrap(tx.objectStore(STORE_NAME).get(id), "Error obtenint dieta");
}

/**
 * Obté totes les dietes emmagatzemades a IndexedDB.
 * @returns {Diet[]} - Array de totes les dietes
 */
export async function getAllDiets() {
  const tx = await getTx();
  return wrap(tx.objectStore(STORE_NAME).getAll(), "Error llistant dietes");
}

/**
 * Obté dietes paginades des d'IndexedDB.
 * Utilitza un cursor per carregar només les dietes necessàries.
 *
 * @param {Object} options - Opcions de paginació
 * @param {number} options.limit - Nombre màxim de dietes a retornar (per defecte 20)
 * @param {number} options.offset - Nombre de dietes a saltar (per defecte 0)
 * @param {string} options.sortBy - Camp per ordenar: "date" o "id" (per defecte "date")
 * @param {string} options.sortOrder - Ordre: "asc" o "desc" (per defecte "desc")
 * @returns {Promise<{diets: Diet[], total: number, hasMore: boolean}>}
 */
export async function getDietsPaginated(options = {}) {
  const {
    limit = 20,
    offset = 0,
    sortBy = "date",
    sortOrder = "desc",
  } = options;

  const tx = await getTx();
  const store = tx.objectStore(STORE_NAME);

  // Obtenir el total de dietes
  const totalCount = await wrap(store.count(), "Error comptant dietes");

  // Si sortBy és "date", usar l'índex
  const source = sortBy === "date" ? store.index(INDEX_DATE) : store;

  // Direcció del cursor segons l'ordre
  const direction = sortOrder === "desc" ? "prev" : "next";

  return new Promise((resolve, reject) => {
    const diets = [];
    let skipped = 0;
    let collected = 0;

    const cursorRequest = source.openCursor(null, direction);

    cursorRequest.onsuccess = (event) => {
      const cursor = event.target.result;

      if (!cursor) {
        // Final del cursor
        resolve({
          diets,
          total: totalCount,
          hasMore: offset + collected < totalCount,
        });
        return;
      }

      // Saltar els primers 'offset' registres
      if (skipped < offset) {
        skipped++;
        cursor.continue();
        return;
      }

      // Recollir fins a 'limit' registres
      if (collected < limit) {
        diets.push(cursor.value);
        collected++;
        cursor.continue();
        return;
      }

      // Ja tenim prou dietes
      resolve({
        diets,
        total: totalCount,
        hasMore: true,
      });
    };

    cursorRequest.onerror = () => {
      reject(new Error("Error paginant dietes: " + cursorRequest.error));
    };
  });
}

/**
 * Elimina una dieta d'IndexedDB per ID.
 * @param {string} id - ID de la dieta a eliminar
 */
export async function deleteDietById(id) {
  if (!id) return;
  const tx = await getTx("readwrite");
  wrap(tx.objectStore(STORE_NAME).delete(id), "Error eliminant dieta");
  await waitTx(tx);
}

/**
 * Elimina totes les dietes d'IndexedDB.
 */
export async function clearAllDiets() {
  const tx = await getTx("readwrite");
  wrap(tx.objectStore(STORE_NAME).clear(), "Error buidant dietes");
  await waitTx(tx);
}

/**
 * Obre la connexió a la base de dades IndexedDB.
 * @returns {IDBDatabase} - Instància de la base de dades
 */
export async function openDatabase() {
  return dbInstance ?? (dbInstance = await openInternal());
}

/**
 * Tanca la connexió a la base de dades IndexedDB.
 */
export function closeDatabase() {
  dbInstance?.close();
  dbInstance = null;
}

// ============================================================================
// GESTIÓ DE PAPERERA (DIETES ELIMINADES)
// ============================================================================

/**
 * Mou una dieta a la paperera (deleted_diets store).
 * @param {Diet} diet - Dieta a moure a la paperera
 */
export async function moveDietToTrash(diet) {
  if (!diet || !diet.id) return;

  const deletedDiet = {
    ...diet,
    deletedAt: new Date().toISOString(),
  };

  const tx = await getTx("readwrite", [STORE_NAME, DELETED_DIETS_STORE]);

  // Eliminar de dietes actives
  wrap(
    tx.objectStore(STORE_NAME).delete(diet.id),
    "Error eliminant dieta de store principal"
  );

  // Afegir a paperera
  wrap(
    tx.objectStore(DELETED_DIETS_STORE).put(deletedDiet),
    "Error movent dieta a paperera"
  );

  await waitTx(tx);
}

/**
 * Restaura una dieta de la paperera.
 * @param {string} id - ID de la dieta a restaurar
 */
export async function restoreDietFromTrash(id) {
  if (!id) return;

  const tx = await getTx("readonly", DELETED_DIETS_STORE);

  // Obtenir dieta de paperera
  const deletedDiet = await wrap(
    tx.objectStore(DELETED_DIETS_STORE).get(id),
    "Error obtenint dieta de paperera"
  );
  await waitTx(tx);

  if (!deletedDiet) {
    throw new Error("Dieta no trobada a la paperera");
  }

  // Eliminar camp deletedAt
  const { deletedAt, ...restoredDiet } = deletedDiet;

  // Moure de paperera a dietes actives
  const tx2 = await getTx("readwrite", [STORE_NAME, DELETED_DIETS_STORE]);

  wrap(
    tx2.objectStore(DELETED_DIETS_STORE).delete(id),
    "Error eliminant de paperera"
  );

  wrap(
    tx2.objectStore(STORE_NAME).put(restoredDiet),
    "Error restaurant dieta"
  );

  await waitTx(tx2);

  return restoredDiet;
}

/**
 * Elimina permanentment una dieta de la paperera.
 * @param {string} id - ID de la dieta a eliminar permanentment
 */
export async function deleteDietFromTrashPermanently(id) {
  if (!id) return;
  const tx = await getTx("readwrite", DELETED_DIETS_STORE);
  wrap(
    tx.objectStore(DELETED_DIETS_STORE).delete(id),
    "Error eliminant dieta permanentment"
  );
  await waitTx(tx);
}

/**
 * Obté totes les dietes eliminades de la paperera.
 * @returns {Diet[]} - Array de dietes eliminades
 */
export async function getAllDeletedDiets() {
  const tx = await getTx("readonly", DELETED_DIETS_STORE);
  return wrap(
    tx.objectStore(DELETED_DIETS_STORE).getAll(),
    "Error obtenint dietes eliminades"
  );
}

/**
 * Neteja dietes eliminades que portin més de X dies a la paperera.
 * @param {number} daysToKeep - Dies a mantenir les dietes eliminades (per defecte 30)
 */
export async function cleanupOldDeletedDiets(daysToKeep = 30) {
  const deletedDiets = await getAllDeletedDiets();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const tx = await getTx("readwrite", DELETED_DIETS_STORE);
  const store = tx.objectStore(DELETED_DIETS_STORE);

  let deletedCount = 0;

  for (const diet of deletedDiets) {
    if (diet.deletedAt && new Date(diet.deletedAt) < cutoffDate) {
      wrap(store.delete(diet.id), "Error eliminant dieta antiga");
      deletedCount++;
    }
  }

  await waitTx(tx);

  return deletedCount;
}

/**
 * Buida completament la paperera.
 */
export async function emptyTrash() {
  const tx = await getTx("readwrite", DELETED_DIETS_STORE);
  wrap(
    tx.objectStore(DELETED_DIETS_STORE).clear(),
    "Error buidant paperera"
  );
  await waitTx(tx);
}
