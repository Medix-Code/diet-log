/**
 * BackupService - Sistema de backups automàtics i exportació de dades
 *
 * Funcionalitats:
 * - Backup automàtic abans de migracions
 * - Exportació manual de totes les dietes
 * - Importació de backups
 * - Validació d'integritat amb checksums
 * - Gestió d'històric de backups
 *
 * @module backupService
 * @version 1.0.0 (2025)
 */

import { logger } from "../utils/logger.js";
import { getAllDiets } from "../db/indexedDbDietRepository.js";

const log = logger.withScope("BackupService");

// Constants
const BACKUP_STORE_NAME = "diet-backups";
const BACKUP_STORE_VERSION = 1;
const MAX_BACKUPS_STORED = 5; // Màxim 5 backups guardats a IndexedDB

/**
 * Obre la base de dades de backups
 * @returns {Promise<IDBDatabase>} Base de dades
 */
async function openBackupDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BACKUP_STORE_NAME, BACKUP_STORE_VERSION);

    request.onerror = () => {
      log.error("Error obrint base de dades de backups");
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("backups")) {
        const store = db.createObjectStore("backups", {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("timestamp", "timestamp", { unique: false });
        store.createIndex("type", "type", { unique: false });
        log.debug("Object store de backups creat");
      }
    };
  });
}

/**
 * Calcula checksum SHA-256
 * @param {string} data - Dades a validar
 * @returns {Promise<string>} Checksum
 */
async function calculateChecksum(data) {
  try {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (error) {
    log.error("Error calculant checksum:", error);
    return "";
  }
}

/**
 * Crea un backup de totes les dietes
 * @param {Array} diets - Array de dietes (opcional, si no es passa les obté de la DB)
 * @param {string} type - Tipus de backup ('auto', 'manual', 'pre-migration')
 * @returns {Promise<Object>} Objecte backup
 */
export async function createBackup(diets = null, type = "manual") {
  try {
    log.debug(`Creant backup tipus "${type}"...`);

    // Si no es passen dietes, obtenir-les de la DB
    if (!diets) {
      diets = await getAllDiets();
    }

    const dataString = JSON.stringify(diets);
    const checksum = await calculateChecksum(dataString);

    const backup = {
      version: "2.0.1",
      type: type,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      totalDiets: diets.length,
      data: diets,
      checksum: checksum,
      metadata: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
      },
    };

    // Guardar a IndexedDB
    await saveBackupToDatabase(backup);

    log.debug(
      `✅ Backup creat: ${diets.length} dietes, ${(
        dataString.length / 1024
      ).toFixed(2)} KB`
    );

    return backup;
  } catch (error) {
    log.error("Error creant backup:", error);
    throw error;
  }
}

/**
 * Guarda un backup a la base de dades
 * @param {Object} backup - Objecte backup
 */
async function saveBackupToDatabase(backup) {
  const db = await openBackupDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["backups"], "readwrite");
    const store = transaction.objectStore("backups");

    // Afegir backup
    const addRequest = store.add(backup);

    addRequest.onsuccess = async () => {
      // Netejar backups antics si n'hi ha més del màxim
      await cleanOldBackups(store);
      resolve();
    };

    addRequest.onerror = () => reject(addRequest.error);
  });
}

/**
 * Neteja backups antics, mantenint només els últims MAX_BACKUPS_STORED
 * @param {IDBObjectStore} store - Object store
 */
async function cleanOldBackups(store) {
  return new Promise((resolve) => {
    const index = store.index("timestamp");
    const request = index.openCursor(null, "prev"); // Ordenar per timestamp descendent

    let count = 0;
    const toDelete = [];

    request.onsuccess = (event) => {
      const cursor = event.target.result;

      if (cursor) {
        count++;

        // Si ja tenim més del màxim, marcar per esborrar
        if (count > MAX_BACKUPS_STORED) {
          toDelete.push(cursor.primaryKey);
        }

        cursor.continue();
      } else {
        // Esborrar els que sobren
        toDelete.forEach((id) => store.delete(id));

        if (toDelete.length > 0) {
          log.debug(`Netejats ${toDelete.length} backups antics`);
        }

        resolve();
      }
    };
  });
}

/**
 * Obté tots els backups guardats
 * @returns {Promise<Array>} Array de backups
 */
export async function getAllBackups() {
  const db = await openBackupDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(["backups"], "readonly");
    const store = transaction.objectStore("backups");
    const request = store.getAll();

    request.onsuccess = () => {
      const backups = request.result || [];
      // Ordenar per timestamp descendent (més recent primer)
      backups.sort((a, b) => b.timestamp - a.timestamp);
      resolve(backups);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Descarrega un backup com a fitxer JSON
 * @param {Object} backup - Objecte backup
 * @param {string} filename - Nom del fitxer (opcional)
 */
export function downloadBackupFile(backup, filename = null) {
  try {
    // Generar nom de fitxer automàtic si no es proporciona
    if (!filename) {
      const date = new Date(backup.timestamp).toISOString().split("T")[0];
      filename = `misdietas-backup-${date}.json`;
    }

    // Crear blob i descarregar
    const dataStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    log.debug(`✅ Backup descarregat: ${filename}`);
  } catch (error) {
    log.error("Error descarregant backup:", error);
    throw error;
  }
}

/**
 * Valida la integritat d'un backup
 * @param {Object} backup - Objecte backup
 * @returns {Promise<boolean>} True si és vàlid
 */
export async function validateBackup(backup) {
  try {
    if (!backup || !backup.data || !backup.checksum) {
      log.warn("Backup amb format invàlid");
      return false;
    }

    const dataString = JSON.stringify(backup.data);
    const calculatedChecksum = await calculateChecksum(dataString);

    if (calculatedChecksum !== backup.checksum) {
      log.warn("Checksum no coincideix - backup corrupte");
      return false;
    }

    return true;
  } catch (error) {
    log.error("Error validant backup:", error);
    return false;
  }
}

/**
 * Crea un backup automàtic abans d'una migració
 * @param {Array} diets - Dietes a fer backup
 * @returns {Promise<Object>} Backup creat
 */
export async function createPreMigrationBackup(diets) {
  log.debug("💾 Creant backup de seguretat abans de migració...");

  const backup = await createBackup(diets, "pre-migration");

  log.debug("✅ Backup de seguretat creat");

  return backup;
}

/**
 * Ofereix a l'usuari descarregar un backup
 * @param {Object} backup - Backup a oferir
 * @param {Function} showModal - Funció per mostrar modal (de toast.js o similar)
 */
export function offerBackupDownload(backup, showModal) {
  // Comprovar si és la primera migració (no oferir sempre)
  const firstMigration = !localStorage.getItem("backup-offered");

  if (!firstMigration) {
    log.debug("Backup ja ofert anteriorment, saltant...");
    return;
  }

  // Mostrar modal amb opció de descarregar
  if (typeof showModal === "function") {
    showModal({
      title: "💾 Backup de seguretat",
      message: `S'ha creat un backup de ${backup.totalDiets} dietes.
                
                ¿Vols descarregar-lo com a mesura de seguretat extra?
                
                (Recomanat abans d'actualitzacions importants)`,
      actions: [
        {
          text: "Descarregar",
          primary: true,
          onClick: () => {
            downloadBackupFile(backup);
            localStorage.setItem("backup-offered", Date.now().toString());
          },
        },
        {
          text: "No, gràcies",
          onClick: () => {
            localStorage.setItem("backup-offered", Date.now().toString());
          },
        },
      ],
    });
  } else {
    // Fallback: descarregar automàticament
    log.warn(
      "Funció showModal no disponible, descarregant backup automàticament"
    );
    downloadBackupFile(backup);
    localStorage.setItem("backup-offered", Date.now().toString());
  }
}

/**
 * Importa dietes des d'un fitxer de backup
 * @param {File} file - Fitxer JSON de backup
 * @returns {Promise<Object>} Backup importat
 */
export async function importBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const backup = JSON.parse(e.target.result);

        // Validar backup
        const isValid = await validateBackup(backup);
        if (!isValid) {
          reject(new Error("Backup invàlid o corrupte"));
          return;
        }

        log.debug(`✅ Backup importat: ${backup.totalDiets} dietes`);
        resolve(backup);
      } catch (error) {
        log.error("Error parsejan backup:", error);
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export default {
  createBackup,
  getAllBackups,
  downloadBackupFile,
  validateBackup,
  createPreMigrationBackup,
  offerBackupDownload,
  importBackupFile,
};
