// Gestió de dietes amb IndexedDB

// Constants de la base de dades
const DB_NAME = "DietasDB";
const DB_VERSION = 2; // Incrementat per suportar dotacions a IndexedDB
const STORE_NAME = "dietas";
const INDEX_DATE = "dateIndex";
const DOTACIONS_STORE = "dotacions";

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
        dotacionsStore.createIndex("timestamp", "timestamp", {
          unique: false,
        });
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

async function getTx(mode = "readonly") {
  const db = dbInstance ?? (dbInstance = await openInternal());
  return db.transaction(STORE_NAME, mode);
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
