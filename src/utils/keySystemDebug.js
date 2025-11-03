/**
 * Utilitats de debugging per al sistema de claus
 * @module keySystemDebug
 */

import {
  diagnoseKeySystem,
  resetKeySystem,
  initializeKeySystem,
} from "./keyManager.js";
import { logger } from "./logger.js";

const log = logger.withScope("KeySystemDebug");

/**
 * Mostra diagnòstic complet del sistema de claus
 */
export async function debugKeySystem() {
  console.group("🔐 Diagnòstic del Sistema de Claus");

  const diagnosis = await diagnoseKeySystem();

  console.log(
    "Encriptació suportada:",
    diagnosis.encryptionSupported ? "✅ Sí" : "❌ No"
  );
  console.log(
    "Sistema inicialitzat:",
    diagnosis.keySystemInitialized ? "✅ Sí" : "❌ No"
  );
  console.log(
    "Clau wrapped existeix:",
    diagnosis.wrappedKeyExists ? "✅ Sí" : "❌ No"
  );
  console.log(
    "Clau wrapped vàlida:",
    diagnosis.wrappedKeyValid ? "✅ Sí" : "❌ No"
  );
  console.log(
    "Device salt existeix:",
    diagnosis.deviceSaltExists ? "✅ Sí" : "❌ No"
  );
  console.log("Pot desencriptar:", diagnosis.canUnwrap ? "✅ Sí" : "❌ No");

  if (diagnosis.errors.length > 0) {
    console.group("⚠️ Errors:");
    diagnosis.errors.forEach((err) => console.error(err));
    console.groupEnd();
  }

  console.groupEnd();

  // Recomanacions
  if (!diagnosis.canUnwrap && diagnosis.wrappedKeyExists) {
    console.warn(
      "⚠️ PROBLEMA DETECTAT: Hi ha una clau guardada però no es pot desencriptar.\n" +
        "Això pot passar si:\n" +
        "  - Has canviat de navegador o dispositiu\n" +
        "  - Les dades estan corruptes\n" +
        "  - El fingerprint del dispositiu ha canviat\n\n" +
        "SOLUCIÓ: Executa fixKeySystem() per resetjar i començar de nou.\n" +
        "ATENCIÓ: Això eliminarà totes les dotacions encriptades existents!"
    );
  }

  return diagnosis;
}

/**
 * Reseteja el sistema de claus amb confirmació
 */
export async function fixKeySystem() {
  const confirmed = confirm(
    "⚠️ ATENCIÓ: Aquesta acció eliminarà TOTES les dotacions encriptades.\n\n" +
      "Les dietes NO es veuran afectades.\n\n" +
      "Vols continuar?"
  );

  if (!confirmed) {
    console.log("Operació cancel·lada per l'usuari");
    return false;
  }

  try {
    console.log("🔄 Resetejant sistema de claus...");
    await resetKeySystem(true); // confirmed=true

    console.log("🔐 Reinicialitzant sistema...");
    await initializeKeySystem();

    console.log("✅ Sistema de claus resetejat i reinicialitzat correctament");
    console.log("ℹ️ Recarrega la pàgina per aplicar els canvis");

    return true;
  } catch (error) {
    console.error("❌ Error resetejant sistema:", error);
    return false;
  }
}

/**
 * Exposa funcions al window per debugging
 */
export function exposeDebugFunctions() {
  if (typeof window !== "undefined") {
    window.debugKeySystem = debugKeySystem;
    window.fixKeySystem = fixKeySystem;

    log.debug(
      "🛠️ Funcions de debug disponibles:\n" +
        "  - debugKeySystem() - Mostra estat del sistema\n" +
        "  - fixKeySystem() - Reseteja sistema de claus"
    );
  }
}

export default {
  debugKeySystem,
  fixKeySystem,
  exposeDebugFunctions,
};
