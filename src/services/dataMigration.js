/**
 * DataMigration - Sistema de migració automàtica de dietes antigues
 *
 * Funcionalitats:
 * - Detecció automàtica de dietes sense encriptar
 * - Migració progressiva i transparent
 * - Backup automàtic abans de migrar
 * - Validació de cada migració
 * - Gestió d'errors sense bloquejar l'app
 * - UI feedback informatiu
 *
 * @module dataMigration
 * @version 1.0.0 (2025)
 */

import { logger } from "../utils/logger.js";
import {
  isEncrypted,
  encryptDiet,
  decryptDiet,
} from "../utils/cryptoManager.js";
import {
  getMasterKey,
  initializeKeySystem,
  isKeySystemInitialized,
} from "../utils/keyManager.js";
import { createPreMigrationBackup } from "./backupService.js";
import { getAllDiets, updateDiet } from "../db/indexedDbDietRepository.js";
import { showToast } from "../ui/toast.js";

const log = logger.withScope("DataMigration");

// Constants
const MIGRATION_KEY = "migration-v2.0.1-encryption";
const MIGRATION_PROGRESS_TOAST_ID = "migration-progress";
const MAX_RETRIES = 3; // Màxim 3 intents per dieta
const RETRY_DELAY_MS = 1000; // 1 segon entre intents

/**
 * Classe principal de migració
 */
export class DataMigration {
  constructor() {
    this.migrationKey = MIGRATION_KEY;
    this.migrationStatus = null;
    this.isRunning = false;
  }

  /**
   * Executa la migració si és necessària
   * (Cridar-ho quan l'app s'inicia)
   * @returns {Promise<Object>} Resultat de la migració
   */
  async runIfNeeded() {
    if (this.isRunning) {
      log.debug("Migració ja en curs, saltant...");
      return { alreadyRunning: true };
    }

    // Comprovar si ja s'ha executat
    if (await this.isAlreadyMigrated()) {
      log.debug("✅ Migració ja completada anteriorment");
      return { alreadyMigrated: true };
    }

    log.debug("🔍 Comprovant si cal migrar dietes...");

    try {
      this.isRunning = true;

      // 1. Inicialitzar sistema de claus si cal
      if (!(await isKeySystemInitialized())) {
        log.debug("🔐 Inicialitzant sistema de claus...");
        await initializeKeySystem();
      }

      // 2. Obtenir totes les dietes
      const allDiets = await getAllDiets();

      // 3. Filtrar només les no encriptades
      const legacyDiets = allDiets.filter((diet) => !isEncrypted(diet));

      if (legacyDiets.length === 0) {
        log.debug("✅ No hi ha dietes per migrar");
        await this.markAsMigrated();
        return { migrated: 0, total: allDiets.length, errors: 0 };
      }

      log.debug(
        `📊 Trobades ${legacyDiets.length} dietes per migrar (de ${allDiets.length} totals)`
      );

      // 4. Executar migració
      const result = await this.migrate(legacyDiets);

      return result;
    } catch (error) {
      log.error("❌ Error en runIfNeeded:", error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Migració principal
   * @param {Array} legacyDiets - Dietes a migrar
   * @returns {Promise<Object>} Resultat
   */
  async migrate(legacyDiets) {
    const total = legacyDiets.length;
    let migrated = 0;
    let errors = 0;
    const errorDetails = [];

    try {
      // 1. Crear backup automàtic de seguretat
      log.debug("💾 Creant backup de seguretat...");
      await createPreMigrationBackup(legacyDiets);
      log.debug("✅ Backup de seguretat creat");

      // 2. Mostrar notificació inicial
      this.showMigrationStartNotification(total);

      // 3. Obtenir clau mestra
      const masterKey = await getMasterKey();

      // 4. Migrar una a una amb retry
      for (let i = 0; i < legacyDiets.length; i++) {
        const diet = legacyDiets[i];

        try {
          // Intentar migrar amb retry automàtic
          const result = await this.migrateSingleDietWithRetry(diet, masterKey);

          if (result.success) {
            migrated++;
          } else {
            errors++;
            errorDetails.push({
              dietId: diet.id,
              error: result.error,
              attempts: result.attempts,
            });
          }

          // Actualitzar UI cada 5 dietes o al final
          if (migrated % 5 === 0 || migrated === total) {
            this.updateMigrationProgress(migrated, total);
          }
        } catch (error) {
          log.error(`❌ Error crític migrant dieta ${diet.id}:`, error);
          errors++;
          errorDetails.push({
            dietId: diet.id,
            error: error.message,
            attempts: MAX_RETRIES,
          });
        }
      }

      // 5. Marcar com a migrat
      await this.markAsMigrated();

      // 6. Mostrar resultat final
      this.showMigrationResult(migrated, errors, total);

      log.debug(
        `✅ Migració completada: ${migrated}/${total} (${errors} errors)`
      );

      return {
        migrated,
        errors,
        total,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined,
      };
    } catch (error) {
      log.error("❌ Error durant la migració:", error);
      this.showMigrationError(error);
      throw error;
    }
  }

  /**
   * Migra una sola dieta amb validació completa i retry automàtic
   * @param {Object} oldDiet - Dieta antiga (sense encriptar)
   * @param {CryptoKey} masterKey - Clau mestra
   * @param {number} maxRetries - Màxim d'intents (per defecte 3)
   * @returns {Promise<Object>} { success: boolean, error?: string, attempts: number }
   */
  async migrateSingleDietWithRetry(
    oldDiet,
    masterKey,
    maxRetries = MAX_RETRIES
  ) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log.debug(`Intent ${attempt}/${maxRetries} per dieta ${oldDiet.id}`);

        await this.migrateSingleDiet(oldDiet, masterKey);

        // Èxit!
        log.debug(`✅ Dieta ${oldDiet.id} migrada (intent ${attempt})`);
        return { success: true, attempts: attempt };
      } catch (error) {
        log.warn(
          `⚠️ Intent ${attempt}/${maxRetries} fallat per dieta ${oldDiet.id}: ${error.message}`
        );

        // Si és l'últim intent, retornar error
        if (attempt === maxRetries) {
          log.error(
            `❌ Dieta ${oldDiet.id} no s'ha pogut migrar després de ${maxRetries} intents`
          );
          return {
            success: false,
            error: error.message,
            attempts: attempt,
          };
        }

        // Esperar abans de reintentar (backoff exponencial)
        const delay = RETRY_DELAY_MS * attempt;
        log.debug(`⏳ Esperant ${delay}ms abans de reintentar...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Aquest punt mai s'hauria d'assolir, però per seguretat
    return {
      success: false,
      error: "Unknown error during migration",
      attempts: maxRetries,
    };
  }

  /**
   * Migra una sola dieta amb validació completa
   * @param {Object} oldDiet - Dieta antiga (sense encriptar)
   * @param {CryptoKey} masterKey - Clau mestra
   */
  async migrateSingleDiet(oldDiet, masterKey) {
    try {
      // 1. Encriptar la dieta
      const encryptedDiet = await encryptDiet(oldDiet, masterKey);

      // 2. VALIDAR desencriptació (crítica!)
      const testDecrypt = await decryptDiet(encryptedDiet, masterKey);

      // 3. Comparar JSON per assegurar que són idèntiques
      // Només comparem camps sensibles (els públics no canvien)
      const originalData = this.extractSensitiveData(oldDiet);
      const decryptedData = this.extractSensitiveData(testDecrypt);

      const originalJson = JSON.stringify(originalData);
      const decryptedJson = JSON.stringify(decryptedData);

      if (originalJson !== decryptedJson) {
        throw new Error("Validation failed: data mismatch after decrypt");
      }

      // 4. Només si passa validació → actualitzar a la DB
      await updateDiet(oldDiet.id, encryptedDiet);

      log.debug(`✅ Dieta ${oldDiet.id} migrada i validada`);
    } catch (error) {
      log.error(`Error migrant dieta ${oldDiet.id}:`, error);
      throw error;
    }
  }

  /**
   * Extreu només dades sensibles per comparació
   * @param {Object} diet - Dieta
   * @returns {Object} Dades sensibles
   */
  extractSensitiveData(diet) {
    return {
      person1: diet.person1 || "",
      person2: diet.person2 || "",
      vehicleNumber: diet.vehicleNumber || "",
      signatureConductor: diet.signatureConductor || "",
      signatureAjudant: diet.signatureAjudant || "",
      services: (diet.services || []).map((s) => ({
        serviceNumber: s.serviceNumber || "",
        origin: s.origin || "",
        destination: s.destination || "",
        notes: s.notes || "",
      })),
    };
  }

  /**
   * UI: Notificació d'inici de migració
   * @param {number} total - Total de dietes a migrar
   */
  showMigrationStartNotification(total) {
    showToast(`🔒 Protegiendo ${total} dietas...`, {
      duration: 2000,
      type: "info",
    });
  }

  /**
   * UI: Actualitzar progrés de migració
   * @param {number} current - Dietes migrades
   * @param {number} total - Total de dietes
   */
  updateMigrationProgress(current, total) {
    const percent = Math.round((current / total) * 100);
    log.debug(`🔄 Migració: ${current}/${total} (${percent}%)`);

    showToast(`🔒 Protegiendo datos... ${current}/${total}`, {
      duration: 1000,
      id: MIGRATION_PROGRESS_TOAST_ID,
      type: "info",
    });
  }

  /**
   * UI: Mostrar resultat final
   * @param {number} migrated - Dietes migrades correctament
   * @param {number} errors - Errors trobats
   * @param {number} total - Total de dietes
   */
  showMigrationResult(migrated, errors, total) {
    if (errors === 0) {
      // Migració perfecta
      showToast(`✅ ${migrated} dietas ya están protegidas`, {
        duration: 4000,
        type: "success",
      });
    } else if (migrated > 0 && errors < total) {
      // Migració parcial
      showToast(
        `⚠️ ${migrated}/${total} dietas protegidas. ${errors} con errores (se reintentará automáticamente)`,
        {
          duration: 7000,
          type: "warning",
        }
      );
    } else if (migrated === 0) {
      // Tot ha fallat
      showToast(
        "❌ No se han podido migrar las dietas. Prueba a recargar la página.",
        {
          duration: 8000,
          type: "error",
        }
      );
    } else {
      // Cas general
      showToast(`ℹ️ ${migrated} dietas migradas, ${errors} con errores`, {
        duration: 5000,
        type: "warning",
      });
    }
  }

  /**
   * UI: Mostrar error crític de migració
   * @param {Error} error - Error
   */
  showMigrationError(error) {
    showToast(`❌ Error en la migración: ${error.message}`, {
      duration: 5000,
      type: "error",
    });
  }

  /**
   * Comprova si la migració ja s'ha executat
   * @returns {Promise<boolean>} True si ja està migrat
   */
  async isAlreadyMigrated() {
    const storage = localStorage.getItem(this.migrationKey);
    return storage === "completed";
  }

  /**
   * Marca la migració com a completada
   */
  async markAsMigrated() {
    localStorage.setItem(this.migrationKey, "completed");
    localStorage.setItem(`${this.migrationKey}-date`, new Date().toISOString());
    log.debug("✅ Migració marcada com a completada");
  }

  /**
   * Reseteja l'estat de migració (per testing/debug)
   * @warning Això farà que es torni a executar la migració
   */
  async resetMigrationStatus() {
    localStorage.removeItem(this.migrationKey);
    localStorage.removeItem(`${this.migrationKey}-date`);
    log.warn("⚠️ Estat de migració resetejat");
  }

  /**
   * Obté l'estat actual de la migració
   * @returns {Object} Estat
   */
  getMigrationStatus() {
    const completed = localStorage.getItem(this.migrationKey) === "completed";
    const date = localStorage.getItem(`${this.migrationKey}-date`);

    return {
      completed,
      date: date ? new Date(date) : null,
      isRunning: this.isRunning,
    };
  }
}

// Instància singleton
export const dataMigration = new DataMigration();

export default dataMigration;
