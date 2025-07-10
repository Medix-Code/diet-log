/**
 * @file indexedDbDietRepository.js
 * @description Repositori IndexedDB per dietes.
 * @module indexedDbDietRepository
 */

const DB_NAME = "DietasDB";
const DB_VERSION = 1;
const STORE_NAME = "dietas";
const INDEX_DATE = "dateIndex";

let dbInstance = null;

async function _connectDB() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      let store;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else {
        store = event.target.transaction.objectStore(STORE_NAME);
      }

      if (!store.indexNames.contains(INDEX_DATE)) {
        store.createIndex(INDEX_DATE, "date", { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      dbInstance.onerror = (errorEvent) => (dbInstance = null);
      dbInstance.onclose = () => (dbInstance = null);
      dbInstance.onversionchange = () => {
        dbInstance.close();
        alert("Base de dades actualitzant. Refresca la pàgina.");
      };

      resolve(dbInstance);
    };

    request.onerror = (event) =>
      reject(event.target.error?.message || event.target.errorCode);

    request.onblocked = () => {
      alert("Tanca altres pestanyes i refresca.");
      reject("Obertura bloquejada.");
    };
  });
}

async function _getTransaction(mode) {
  const db = await _connectDB();
  return db.transaction(STORE_NAME, mode);
}

function _requestToPromise(request, errorMessage) {
  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) =>
      reject(
        `${errorMessage}: ${
          event.target.error?.message || event.target.errorCode
        }`
      );
  });
}

function _waitTx(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function openDatabase() {
  return _connectDB();
}

export async function addDiet(diet) {
  const tx = await _getTransaction("readwrite");
  tx.objectStore(STORE_NAME).add(diet);
  await _waitTx(tx);
  return diet.id;
}

export async function updateDiet(diet) {
  const tx = await _getTransaction("readwrite");
  tx.objectStore(STORE_NAME).put(diet);
  await _waitTx(tx);
  return diet.id;
}

export async function getAllDiets() {
  const tx = await _getTransaction("readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  return _requestToPromise(request, "Error recuperant dietes");
}

export async function getDiet(id) {
  if (!id) return undefined;
  const tx = await _getTransaction("readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(id);
  return _requestToPromise(request, "Error recuperant dieta");
}

export async function deleteDietById(id) {
  if (!id) return;
  const tx = await _getTransaction("readwrite");
  const store = tx.objectStore(STORE_NAME);
  const request = store.delete(id);
  await _requestToPromise(request, "Error eliminant dieta");
  await _waitTx(tx);
}

export async function clearAllDiets() {
  const tx = await _getTransaction("readwrite");
  const store = tx.objectStore(STORE_NAME);
  const request = store.clear();
  await _requestToPromise(request, "Error buidant dietes");
  await _waitTx(tx);
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
