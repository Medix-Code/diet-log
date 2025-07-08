/**
 * @file pdfService.js
 * @description Lògica per generar, omplir i descarregar documents PDF de dietes.
 * @module pdfService
 */

// Importacions de mòduls interns
import { showToast } from "../ui/toast.js";

import { gatherAllData } from "./formService.js";
import { validateDadesTab, validateServeisTab } from "../utils/validation.js";
// Importacions del servei PWA
import { requestInstallPromptAfterAction } from "./pwaService.js";

// --- Constants ---

const DOM_IDS = {
  DADES_TAB: "tab-dades",
  SERVEIS_TAB: "tab-serveis",
};

const CSS_CLASSES = {
  ERROR_TAB: "error-tab",
};

const PDF_SETTINGS = {
  TEMPLATE_URLS: {
    DEFAULT: "./dieta_tsc.pdf",
    EMPRESA_2: "./dieta_tsc.pdf",
  },
  SERVICE_Y_OFFSET: 82,
  SIGNATURE_WIDTH: 100,
  SIGNATURE_HEIGHT: 50,
  WATERMARK_TEXT: "misdietas.com",
  DEFAULT_FILENAME: "dieta.pdf",
  EMPTY_FIELD_PLACEHOLDER: "",
  SERVICE_NUMBER_COLOR: "#004aad", // Verd fosc
  MODE_PREFIX_TEXT_COLOR: "#8B0000", // Vermell fosc (DarkRed) per al text "3.11", "3.22"
  MAX_SIGNATURE_NAME_LENGTH: 31,
};

/**
 * Coordenadas generales para la plantilla PDF.
 */
const generalFieldCoordinates = {
  date: { x: 155, y: 732, size: 16, color: "#000000" },
  vehicleNumber: { x: 441, y: 732, size: 16, color: "#000000" }, //384
  person1: { x: 65, y: 368, size: 16, color: "#000000" },
  person2: { x: 310, y: 368, size: 16, color: "#000000" },
};

/**
 * Coordenadas base para cada servicio.
 */
const baseServiceFieldCoordinates = {
  serviceNumber: { x: 130, y: 715, size: 16, color: "#000000" },
  origin: { x: 232, y: 698, size: 16, color: "#000000" },
  originTime: { x: 441, y: 698, size: 16, color: "#000000" }, // X original per hores
  destination: { x: 232, y: 683, size: 16, color: "#000000" },
  destinationTime: { x: 441, y: 681, size: 16, color: "#000000" }, // X original per hores

  // Coordenades per a endTime quan el mode és 3.6 (o no hi ha mode especial)
  endTimeNormal: { x: 441, y: 665, size: 16, color: "#000000" }, // X original per hores

  // >>> COORDENADES EXPLÍCITES PER AL PREFIX DEL MODE I L'HORA QUAN HI HA PREFIX <<<
  // Aquestes s'utilitzaran quan el mode NO sigui 3.6 i endTime tingui valor.
  endTimeModeText: {
    x: 390,
    y: 665,
    size: 16,
    color: PDF_SETTINGS.MODE_PREFIX_TEXT_COLOR,
  }, // << AJUSTA LA X (390) PER POSICIONAR "3.11"
  endTimeValueWhenPrefixed: { x: 441, y: 665, size: 16, color: "#000000" }, // << X PER A "HH:MM" (HAURIA DE SER IGUAL A endTimeNormal.x)
};

/**
 * Coordenadas para las firmas.
 */
const signatureCoordinates = {
  conductor: { x: 125, y: 295, width: 100, height: 50 },
  ayudante: { x: 380, y: 295, width: 100, height: 50 },
};

/**
 * Coordenadas para la marca de agua.
 */
const fixedTextCoordinates = {
  website: { x: 250, y: 20, size: 6, color: "#EEEEEE" },
};

// --- Funcions Auxiliars ---

/**
 * Converteix un string a "Title Case" (primera lletra de cada paraula en majúscula),
 * gestionant accents i dièresis.
 * @param {string} str - La cadena de text a convertir.
 * @returns {string} La cadena en format Title Case.
 */
function toTitleCase(str) {
  if (!str || typeof str !== "string" || str.trim() === "") return ""; // Retorna buit si no hi ha res o només espais

  // Separem per paraules (considerant múltiples espais)
  // i filtrem elements buits que puguin sorgir de múltiples espais.
  const words = str.split(/\s+/).filter((word) => word.length > 0);

  const titleCasedWords = words.map((word) => {
    // Gestionar paraules amb guions interns, com "anna-sofia"
    if (word.includes("-")) {
      return word
        .split("-")
        .map((part) => {
          if (part.length === 0) return ""; // Part buida (ex: "--")
          return part.charAt(0).toUpperCase() + part.substring(1).toLowerCase();
        })
        .join("-");
    } else {
      // Paraula simple
      return word.charAt(0).toUpperCase() + word.substring(1).toLowerCase();
    }
  });

  return titleCasedWords.join(" ");
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return { r: 0, g: 0, b: 0 };
  const sanitizedHex = hex.replace("#", "");
  if (sanitizedHex.length !== 6) return { r: 0, g: 0, b: 0 };
  const bigint = parseInt(sanitizedHex, 16);
  if (isNaN(bigint)) return { r: 0, g: 0, b: 0 };
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function formatDateForPdf(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return "";
  const [yyyy, mm, dd] = dateString.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function getPdfTemplateUrl(generalData) {
  // Aquesta funció es manté per a futura compatibilitat, tot i que ara no canvia la plantilla.
  return PDF_SETTINGS.TEMPLATE_URLS.DEFAULT;
}

function handleValidationUIErrors(isDadesValid, isServeisValid) {
  const dadesTabElement = document.getElementById(DOM_IDS.DADES_TAB);
  const serveisTabElement = document.getElementById(DOM_IDS.SERVEIS_TAB);
  dadesTabElement?.classList.remove(CSS_CLASSES.ERROR_TAB);
  serveisTabElement?.classList.remove(CSS_CLASSES.ERROR_TAB);
  let toastMessage = "";
  if (!isDadesValid && !isServeisValid) {
    toastMessage = "Completa los campos obligatorios en Datos y Servicios.";
    dadesTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
    serveisTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else if (!isDadesValid) {
    toastMessage = "Completa los campos obligatorios en la pestaña Datos.";
    dadesTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else if (!isServeisValid) {
    toastMessage = "Completa los campos obligatorios en la pestaña Servicios.";
    serveisTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  }
  if (toastMessage) showToast(toastMessage, "error");
}

// --- Funcions Principals ---

export async function fillPdf(data, servicesData) {
  if (!data || !Array.isArray(servicesData)) {
    throw new Error("Dades invàlides proporcionades a fillPdf.");
  }
  if (!window.PDFLib) {
    throw new Error("La llibreria PDFLib no està carregada.");
  }

  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  try {
    const pdfTemplateUrl = getPdfTemplateUrl(data);
    const pdfBytes = await fetch(pdfTemplateUrl).then((res) =>
      res.arrayBuffer()
    );
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];
    const defaultTextColorRgbFn = (hex) => {
      const c = hexToRgb(hex);
      return rgb(c.r / 255, c.g / 255, c.b / 255);
    };

    // 1) Camps Generals
    Object.entries(generalFieldCoordinates).forEach(([field, coords]) => {
      let value = data[field] || "";
      if (field === "date") value = formatDateForPdf(value);
      if (field === "vehicleNumber") value = value.toUpperCase();
      if (
        (field === "person1" || field === "person2") &&
        value.length > PDF_SETTINGS.MAX_SIGNATURE_NAME_LENGTH
      ) {
        value =
          toTitleCase(value).substring(
            0,
            PDF_SETTINGS.MAX_SIGNATURE_NAME_LENGTH - 3
          ) + "...";
      } else if (field === "person1" || field === "person2") {
        value = toTitleCase(value);
      }
      page.drawText(value, {
        ...coords,
        font: helveticaFont,
        color: defaultTextColorRgbFn(coords.color),
      });
    });

    // 2) Serveis
    servicesData.forEach((service, index) => {
      const yOffset = index * PDF_SETTINGS.SERVICE_Y_OFFSET;
      const serviceMode = service.mode || "3.6";

      // Dibuixa camps sempre presents
      page.drawText(service.serviceNumber || "", {
        ...baseServiceFieldCoordinates.serviceNumber,
        y: baseServiceFieldCoordinates.serviceNumber.y - yOffset,
        font: helveticaFont,
        color: defaultTextColorRgbFn(PDF_SETTINGS.SERVICE_NUMBER_COLOR),
      });
      page.drawText(service.origin || "", {
        ...baseServiceFieldCoordinates.origin,
        y: baseServiceFieldCoordinates.origin.y - yOffset,
        font: helveticaFont,
        color: defaultTextColorRgbFn(baseServiceFieldCoordinates.origin.color),
      });
      page.drawText(service.originTime || "", {
        ...baseServiceFieldCoordinates.originTime,
        y: baseServiceFieldCoordinates.originTime.y - yOffset,
        font: helveticaFont,
        color: defaultTextColorRgbFn(
          baseServiceFieldCoordinates.originTime.color
        ),
      });

      // >>> LÒGICA CONDICIONAL PER A CAMPS DE DESTÍ <<<
      if (serviceMode === "3.6") {
        page.drawText(service.destination || "", {
          ...baseServiceFieldCoordinates.destination,
          y: baseServiceFieldCoordinates.destination.y - yOffset,
          font: helveticaFont,
          color: defaultTextColorRgbFn(
            baseServiceFieldCoordinates.destination.color
          ),
        });
        page.drawText(service.destinationTime || "", {
          ...baseServiceFieldCoordinates.destinationTime,
          y: baseServiceFieldCoordinates.destinationTime.y - yOffset,
          font: helveticaFont,
          color: defaultTextColorRgbFn(
            baseServiceFieldCoordinates.destinationTime.color
          ),
        });
      }

      // Lògica per a l'hora final (amb o sense prefix de mode)
      const endTimeValue = (service.endTime || "").trim();
      if (serviceMode !== "3.6" && endTimeValue) {
        page.drawText(serviceMode, {
          ...baseServiceFieldCoordinates.endTimeModeText,
          y: baseServiceFieldCoordinates.endTimeModeText.y - yOffset,
          font: helveticaFont,
          color: defaultTextColorRgbFn(
            baseServiceFieldCoordinates.endTimeModeText.color
          ),
        });
        page.drawText(endTimeValue, {
          ...baseServiceFieldCoordinates.endTimeValueWhenPrefixed,
          y: baseServiceFieldCoordinates.endTimeValueWhenPrefixed.y - yOffset,
          font: helveticaFont,
          color: defaultTextColorRgbFn(
            baseServiceFieldCoordinates.endTimeValueWhenPrefixed.color
          ),
        });
      } else {
        page.drawText(endTimeValue, {
          ...baseServiceFieldCoordinates.endTimeNormal,
          y: baseServiceFieldCoordinates.endTimeNormal.y - yOffset,
          font: helveticaFont,
          color: defaultTextColorRgbFn(
            baseServiceFieldCoordinates.endTimeNormal.color
          ),
        });
      }
    });

    // 3) Firmes i Marca d'Aigua
    const embedAndDrawSignature = async (signatureData, coords) => {
      if (signatureData) {
        try {
          const pngImage = await pdfDoc.embedPng(signatureData);
          page.drawImage(pngImage, { ...coords });
        } catch (sigError) {
          console.warn("Error en incrustar la signatura:", sigError);
        }
      }
    };
    await embedAndDrawSignature(
      data.signatureConductor,
      signatureCoordinates.conductor
    );
    await embedAndDrawSignature(
      data.signatureAjudant,
      signatureCoordinates.ayudante
    );

    const text = PDF_SETTINGS.WATERMARK_TEXT;
    const textSize = fixedTextCoordinates.website.size;
    const textWidth = helveticaFont.widthOfTextAtSize(text, textSize);
    const xCentered = (page.getWidth() - textWidth) / 2;
    page.drawText(text, {
      x: xCentered,
      y: fixedTextCoordinates.website.y,
      size: textSize,
      font: helveticaFont,
      color: defaultTextColorRgbFn(fixedTextCoordinates.website.color),
    });

    return await pdfDoc.save();
  } catch (error) {
    console.error("Error detallat dins de fillPdf:", error);
    throw new Error(`Error durant la generació del PDF: ${error.message}`);
  }
}

export function buildPdfFileName(dateValue, dietType) {
  const datePart = formatDateForPdf(dateValue).replace(/\//g, "_");
  if (!datePart) return PDF_SETTINGS.DEFAULT_FILENAME;
  let typePart = "dieta";
  if (dietType === "lunch") typePart = "dieta_comida";
  else if (dietType === "dinner") typePart = "dieta_cena";
  return `${typePart}_${datePart}.pdf`;
}

export async function generateAndDownloadPdf() {
  if (!validateDadesTab() || !validateServeisTab()) {
    handleValidationUIErrors(validateDadesTab(), validateServeisTab());
    return;
  }

  document
    .getElementById(DOM_IDS.DADES_TAB)
    ?.classList.remove(CSS_CLASSES.ERROR_TAB);
  document
    .getElementById(DOM_IDS.SERVEIS_TAB)
    ?.classList.remove(CSS_CLASSES.ERROR_TAB);

  try {
    showToast("Generando PDF...", "info");

    const { generalData, servicesData } = gatherAllData();
    if (!generalData || !servicesData) {
      throw new Error("No se han podido recoger los datos del formulario.");
    }

    const pdfBytes = await fillPdf(generalData, servicesData);
    const fileName = buildPdfFileName(generalData.date, generalData.dietType);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 500);
    showToast("PDF generado correctamente.", "success");

    // Notificació PWA
    if (typeof requestInstallPromptAfterAction === "function") {
      requestInstallPromptAfterAction();
    }
  } catch (error) {
    console.error("Error durant generateAndDownloadPdf:", error);
    showToast(
      `Error al generar el PDF: ${error.message || "Error desconocido"}`,
      "error"
    );
  }
}
