/**
 * @file pdfService.js
 * @description Genera i descarrega PDF de dietes amb validacions i marges simètrics per a la secció de notes.
 * @module pdfService
 */

import { pseudoId } from "../utils/pseudoId.js";
import { showToast } from "../ui/toast.js";
import { gatherAllData } from "./formService.js";
import { validateDadesTab, validateServeisTab } from "../utils/validation.js";
import { requestInstallPromptAfterAction } from "./pwaInstallHandler.js";
import { getDiet } from "../db/indexedDbDietRepository.js";
import { logger } from "../utils/logger.js";
import {
  fillPdf,
  PDF_SETTINGS,
  formatDateForPdf,
} from "./pdf/pdfTemplate.js";
import { loadExternalScript } from "../utils/secureScriptLoader.js";
import RateLimiter from "../utils/rateLimiter.js";

// Lazy loading PDFLib
let pdfLibLoaded = false;
let pdfLibLoadPromise = null;
const log = logger.withScope("PdfService");
const PDF_LIB_SCRIPT_URL =
  "https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js";
const PDF_LIB_SCRIPT_INTEGRITY =
  "sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI";

// Rate Limiter per generació de PDFs (20 PDFs per minut màx)
const pdfRateLimiter = new RateLimiter(20, 60000, 'generació de PDF');

async function loadPdfLib() {
  if (pdfLibLoaded && window.PDFLib) return;
  if (!pdfLibLoadPromise) {
    pdfLibLoadPromise = loadExternalScript({
      src: PDF_LIB_SCRIPT_URL,
      integrity: PDF_LIB_SCRIPT_INTEGRITY,
    })
      .then(() => {
        if (!window.PDFLib) {
          throw new Error("PDF-Lib no disponible després de carregar script.");
        }
        pdfLibLoaded = true;
      })
      .catch((error) => {
        pdfLibLoadPromise = null;
        throw error;
      });
  }
  await pdfLibLoadPromise;
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Control global de marges exteriors de la plantilla i de la separació interna
 * del text respecte la línia vertical.  D’aquesta manera el marge dret queda
 * sempre idèntic al marge esquerre sense dependre de valors màgics.
 */
const DOM_IDS = {
  DADES_TAB: "tab-dades",
  SERVEIS_TAB: "tab-serveis",
};

const CSS_CLASSES = {
  ERROR_TAB: "error-tab",
};

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function handleValidationUIErrors(isDadesValid, isServeisValid) {
  const dadesTab = document.getElementById(DOM_IDS.DADES_TAB);
  const serveisTab = document.getElementById(DOM_IDS.SERVEIS_TAB);
  dadesTab?.classList.remove(CSS_CLASSES.ERROR_TAB);
  serveisTab?.classList.remove(CSS_CLASSES.ERROR_TAB);

  let message = "";
  if (!isDadesValid && !isServeisValid) {
    message = "Completa els camps obligatoris a Dades i Serveis.";
    dadesTab?.classList.add(CSS_CLASSES.ERROR_TAB);
    serveisTab?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else if (!isDadesValid) {
    message = "Completa els camps obligatoris a Dades.";
    dadesTab?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else {
    message = "Completa els camps obligatoris a Serveis.";
    serveisTab?.classList.add(CSS_CLASSES.ERROR_TAB);
  }

  if (message) showToast(message, "error");
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

// -----------------------------------------------------------------------------
// Core Functions
// -----------------------------------------------------------------------------

/**
 * Omple la plantilla PDF amb les dades de la dieta.
 * Inclou marges simètrics per a la secció de notes sense valors màgics.
 */

// -----------------------------------------------------------------------------
// Funcions d’alta nivell exposades
// -----------------------------------------------------------------------------

export function buildPdfFileName(dateValue, dietType) {
  const datePart = formatDateForPdf(dateValue).replace(/\//g, "_") || "";
  const typePart =
    dietType === "lunch"
      ? "dieta_comida"
      : dietType === "dinner"
      ? "dieta_cena"
      : "dieta";
  return datePart
    ? `${typePart}_${datePart}.pdf`
    : PDF_SETTINGS.DEFAULT_FILENAME;
}

export async function generateAndDownloadPdf() {
  // Comprovació de Rate Limiting
  if (!pdfRateLimiter.canMakeRequest()) {
    const remaining = pdfRateLimiter.getRemainingRequests();
    showToast(
      `Has superat el límit de generació de PDFs. Espera uns segons. (${remaining} disponibles)`,
      "warning"
    );
    return;
  }

  const isDadesValid = validateDadesTab();
  const isServeisValid = validateServeisTab();

  if (!isDadesValid || !isServeisValid) {
    handleValidationUIErrors(isDadesValid, isServeisValid);
    return;
  }

  document
    .getElementById(DOM_IDS.DADES_TAB)
    ?.classList.remove(CSS_CLASSES.ERROR_TAB);
  document
    .getElementById(DOM_IDS.SERVEIS_TAB)
    ?.classList.remove(CSS_CLASSES.ERROR_TAB);

  try {
    const { generalData, servicesData } = gatherAllData();
    if (!generalData || !servicesData) throw new Error("Dades no recollides.");

    await loadPdfLib();
    const pdfBytes = await fillPdf(generalData, servicesData);
    const fileName = buildPdfFileName(generalData.date, generalData.dietType);
    downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), fileName);

    if (typeof gtag === "function") {
      gtag("event", "download_pdf", {
        event_category: "PDF Generation",
        event_label: "Download from main form",
      });
    }

    showToast("Descàrrega iniciada correctament.", "success");
    requestInstallPromptAfterAction();
  } catch (error) {
    log.error("Error generant PDF des del formulari principal:", error);
    showToast(
      `Error en la generació del PDF: ${error.message || "Desconegut"}`,
      "error"
    );
  }
}

export async function downloadDietPDF(dietId) {
  if (!dietId) {
    showToast("ID de dieta inválido.", "error");
    return;
  }

  // Comprovació de Rate Limiting
  if (!pdfRateLimiter.canMakeRequest()) {
    const remaining = pdfRateLimiter.getRemainingRequests();
    showToast(
      `Has superat el límit de generació de PDFs. Espera uns segons. (${remaining} disponibles)`,
      "warning"
    );
    return;
  }

  try {
    //  Hash si no es ya un hash de 64 caracteres
    const hashedId = dietId.length === 64 ? dietId : await pseudoId(dietId);
    const diet = await getDiet(hashedId);
    if (!diet) throw new Error("Dieta no encontrada.");

    const generalData = {
      date: diet.date || "",
      dietType: diet.dietType || "",
      vehicleNumber: diet.vehicleNumber || "",
      person1: diet.person1 || "",
      person2: diet.person2 || "",
      serviceType: diet.serviceType || "TSU",
      signatureConductor: diet.signatureConductor || "",
      signatureAjudant: diet.signatureAjudant || "",
    };

    const servicesData = diet.services.map((service) => ({
      serviceNumber: service.serviceNumber || "",
      origin: service.origin || "",
      originTime: service.originTime || "",
      destination: service.destination || "",
      destinationTime: service.destinationTime || "",
      endTime: service.endTime || "",
      mode: service.mode || "3.6",
      notes: service.notes || "",
    }));

    await loadPdfLib();
    const pdfBytes = await fillPdf(generalData, servicesData);
    const fileName = buildPdfFileName(generalData.date, generalData.dietType);
    downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), fileName);

    // Envia l'esdeveniment a Google Analytics
    if (typeof gtag === "function") {
      gtag("event", "download_pdf", {
        event_category: "PDF Generation",
        event_label: "Download from saved list", // Etiqueta diferent per saber d'on ve
      });
    }

    showToast("Descarga iniciada correctamente.", "success");
  } catch (error) {
    log.error("Error en downloadDietPDF:", error);
    showToast(
      `Error en la generación del PDF: ${error.message || "Desconocido"}`,
      "error"
    );
  }
}
