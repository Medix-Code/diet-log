/**
 * @file indexedDbDietRepository.js
 * @description Repositori IndexedDB per a dietes.
 * @module indexedDbDietRepository
 */

const DB_NAME = "DietasDB";
const DB_VERSION = 1;
const STORE_NAME = "dietas";
const INDEX_DATE = "dateIndex";

let dbInstance = null;

/*──────────────────── Connexió i upgrade ────────────────────*/
function openInternal() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      let store;

      // Crea l'objectStore si no existeix
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else {
        store = event.target.transaction.objectStore(STORE_NAME);
      }

      // Índex per data (ja existia a la primera versió)
      if (!store.indexNames.contains(INDEX_DATE)) {
        store.createIndex(INDEX_DATE, "date", { unique: false });
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

/*────────────────────────── CRUD ──────────────────────────*/
export async function addDiet(diet) {
  const tx = await getTx("readwrite");
  wrap(tx.objectStore(STORE_NAME).add(diet), "No s'ha pogut afegir");
  await waitTx(tx);
  return diet.id;
}

export async function updateDiet(diet) {
  const tx = await getTx("readwrite");
  wrap(tx.objectStore(STORE_NAME).put(diet), "No s'ha pogut actualitzar");
  await waitTx(tx);
  return diet.id;
}

export async function getDiet(id) {
  if (!id) return undefined;
  const tx = await getTx();
  return wrap(tx.objectStore(STORE_NAME).get(id), "Error obtenint dieta");
}

export async function getAllDiets() {
  const tx = await getTx();
  return wrap(tx.objectStore(STORE_NAME).getAll(), "Error llistant dietes");
}

export async function deleteDietById(id) {
  if (!id) return;
  const tx = await getTx("readwrite");
  wrap(tx.objectStore(STORE_NAME).delete(id), "Error eliminant dieta");
  await waitTx(tx);
}

export async function clearAllDiets() {
  const tx = await getTx("readwrite");
  wrap(tx.objectStore(STORE_NAME).clear(), "Error buidant dietes");
  await waitTx(tx);
}

export function closeDatabase() {
  dbInstance?.close();
  dbInstance = null;
}
