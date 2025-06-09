/**
 * @file indexedDbDietRepository.js
 * @description Repositori per interactuar amb IndexedDB per a les Dietes.
 *              Gestiona la connexió i les operacions CRUD.
 * @module indexedDbDietRepository
 */

// --- Constants ---
const DB_NAME = "DietasDB"; // Nom diferent si canvia l'estructura
const DB_VERSION = 1; // Incrementa si canvies índexs o estructura
const STORE_NAME = "dietas";
const INDEX_DATE = "dateIndex"; // Nou índex per data (opcional)

// --- Variables d'Estat del Mòdul ---
let dbInstance = null; // Variable per mantenir la instància de la BD oberta

// --- Funcions Privades ---

/**
 * Obre (o crea/actualitza) la connexió amb la base de dades IndexedDB.
 * Guarda la instància a dbInstance per reutilitzar-la.
 * @private
 * @returns {Promise<IDBDatabase>} Promesa que resol amb la instància de la BD.
 */
function _connectDB() {
  // Si ja tenim una instància vàlida, la retornem directament
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    console.log(`Obrint BD ${DB_NAME} versió ${DB_VERSION}...`);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      console.log("Executant onupgradeneeded...");
      const db = event.target.result;
      let store;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        console.log(`Creant object store ${STORE_NAME}...`);
        store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
      } else {
        console.log(`Object store ${STORE_NAME} ja existeix.`);
        store = event.target.transaction.objectStore(STORE_NAME); // Obtenir store existent
      }

      // Crear/Verificar índex per data (opcional, però útil per a cerques/ordenació)
      if (!store.indexNames.contains(INDEX_DATE)) {
        console.log(`Creant índex ${INDEX_DATE} sobre 'date'...`);
        store.createIndex(INDEX_DATE, "date", { unique: false });
      } else {
        console.log(`Índex ${INDEX_DATE} ja existeix.`);
      }

      // Eliminar índex antic si ja no s'usa
      // if (store.indexNames.contains("dateTime")) {
      //     console.log("Eliminant índex antic 'dateTime'...");
      //     store.deleteIndex("dateTime");
      // }

      console.log("onupgradeneeded completat.");
    };

    request.onsuccess = (event) => {
      console.log(`BD ${DB_NAME} oberta amb èxit.`);
      dbInstance = event.target.result;

      // Manejadors d'errors/tancament per a la connexió persistent
      dbInstance.onerror = (errorEvent) => {
        console.error(
          "Error inesperat a la base de dades:",
          errorEvent.target.error
        );
        // Podria intentar tancar i reiniciar la connexió?
        dbInstance = null; // Invalida la instància
      };
      dbInstance.onclose = () => {
        console.warn(`Connexió a la BD ${DB_NAME} tancada.`);
        dbInstance = null; // Marca com tancada per forçar reconnexió
      };
      dbInstance.onversionchange = () => {
        console.warn(
          `Detectat canvi de versió de la BD. Tancant connexió actual...`
        );
        if (dbInstance) {
          dbInstance.close();
        }
        alert(
          "La base de dades s'està actualitzant. Si us plau, refresca la pàgina."
        );
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error(`Error obrint la BD ${DB_NAME}:`, event.target.error);
      reject(
        `Error obrint la base de dades: ${
          event.target.error?.message || event.target.errorCode
        }`
      );
    };

    request.onblocked = () => {
      // Això passa si hi ha una altra pestanya amb una versió anterior oberta
      console.warn(
        `Obertura de la BD ${DB_NAME} bloquejada. Possiblement una altra pestanya està oberta amb una versió anterior.`
      );
      alert(
        "Hi ha una altra versió de l'aplicació oberta. Si us plau, tanca les altres pestanyes i refresca."
      );
      reject("Obertura de base de dades bloquejada.");
    };
  });
}

/**
 * Obté una transacció d'IndexedDB.
 * @private
 * @param {IDBTransactionMode} mode - 'readonly' o 'readwrite'.
 * @returns {Promise<IDBTransaction>} Promesa que resol amb la transacció.
 */
async function _getTransaction(mode) {
  const db = await _connectDB(); // Assegura connexió
  return db.transaction(STORE_NAME, mode);
}

/**
 * Executa una petició d'IndexedDB dins d'una promesa.
 * @private
 * @param {IDBRequest} request - La petició a executar.
 * @param {string} errorMessage - Missatge d'error per a la promesa rebutjada.
 * @returns {Promise<any>} Promesa que resol amb el resultat de la petició o rebutja amb error.
 */
function _requestToPromise(request, errorMessage) {
  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => {
      console.error(`${errorMessage}:`, event.target.error);
      reject(
        `${errorMessage}: ${
          event.target.error?.message || event.target.errorCode
        }`
      );
    };
  });
}

// --- Funcions Públiques / Exportades ---

/**
 * Inicialitza la connexió amb la base de dades.
 * Es recomana cridar-la un cop a l'inici de l'aplicació.
 * @export
 * @returns {Promise<IDBDatabase>} Promesa que resol quan la connexió està llesta.
 */
export async function openDatabase() {
  // Simplement crida a la funció interna de connexió
  // Aquesta funció es pot cridar múltiples vegades, però només obrirà la BD un cop.
  return _connectDB();
}

/**
 * Afegeix una nova Dieta a la base de dades.
 * @param {Diet} diet - L'objecte Dieta a afegir.
 * @returns {Promise<string>} Promesa que resol amb l'ID de la dieta afegida.
 * @export
 */
export async function addDiet(diet) {
  const tx = await _getTransaction("readwrite");
  const store = tx.objectStore(STORE_NAME);
  const request = store.add(diet);
  return _requestToPromise(request, "Error en afegir la dieta");
}

/**
 * Actualitza una Dieta existent a la base de dades.
 * @param {Diet} diet - L'objecte Dieta amb les dades actualitzades (ha d'incloure l'ID).
 * @returns {Promise<string>} Promesa que resol amb l'ID de la dieta actualitzada.
 * @export
 */
export async function updateDiet(diet) {
  const tx = await _getTransaction("readwrite");
  const store = tx.objectStore(STORE_NAME);
  const request = store.put(diet); // put actualitza o insereix si no existeix
  return _requestToPromise(request, "Error en actualitzar la dieta");
}

/**
 * Obté totes les Dietes emmagatzemades.
 * @returns {Promise<Diet[]>} Promesa que resol amb un array de totes les dietes.
 * @export
 */
export async function getAllDiets() {
  const tx = await _getTransaction("readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();
  // Opcional: Ordenar per data (requereix índex)
  // const index = store.index(INDEX_DATE);
  // const request = index.getAll(null, 'prev'); // Ordena per data descendent
  return _requestToPromise(request, "Error en recuperar les dietes");
}

/**
 * Obté una Dieta específica pel seu ID.
 * @param {string} id - L'ID de la dieta a obtenir.
 * @returns {Promise<Diet|undefined>} Promesa que resol amb l'objecte Dieta o undefined si no es troba.
 * @export
 */
export async function getDiet(id) {
  if (!id) return Promise.resolve(undefined); // Retorna undefined si l'ID és buit/nul
  const tx = await _getTransaction("readonly");
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(id);
  return _requestToPromise(request, "Error en recuperar la dieta");
}

/**
 * Elimina una Dieta específica pel seu ID.
 * @param {string} id - L'ID de la dieta a eliminar.
 * @returns {Promise<void>} Promesa que resol quan s'ha eliminat.
 * @export
 */
export async function deleteDietById(id) {
  if (!id) return Promise.resolve(); // No fa res si l'ID és buit/nul
  const tx = await _getTransaction("readwrite");
  const store = tx.objectStore(STORE_NAME);
  const request = store.delete(id);
  // _requestToPromise espera un resultat, delete no en retorna,
  // fem una promesa específica per a delete/clear.
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = (event) => {
      console.error("Error en eliminar la dieta:", event.target.error);
      reject(
        `Error en eliminar la dieta: ${
          event.target.error?.message || event.target.errorCode
        }`
      );
    };
    tx.oncomplete = () =>
      console.log(`Transacció d'eliminació completada per ID: ${id}`);
    tx.onerror = (event) =>
      console.error("Error en la transacció d'eliminació:", event.target.error);
  });
}

/**
 * Elimina TOTES les Dietes de la base de dades.
 * @returns {Promise<void>} Promesa que resol quan s'han eliminat totes les dietes.
 * @export
 */
export async function clearAllDiets() {
  const tx = await _getTransaction("readwrite");
  const store = tx.objectStore(STORE_NAME);
  const request = store.clear();
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = (event) => {
      console.error("Error en buidar les dietes:", event.target.error);
      reject(
        `Error en buidar les dietes: ${
          event.target.error?.message || event.target.errorCode
        }`
      );
    };
    tx.oncomplete = () => console.log(`Object store '${STORE_NAME}' buidat.`);
    tx.onerror = (event) =>
      console.error("Error en la transacció de buidat:", event.target.error);
  });
}

/**
 * Tanca la connexió amb la base de dades (si està oberta).
 * Pot ser útil en desconnectar o abans d'una actualització forçada.
 * @export
 */
export function closeDatabase() {
  if (dbInstance) {
    console.log(`Tancant connexió a la BD ${DB_NAME}...`);
    dbInstance.close();
    dbInstance = null;
  }
}
