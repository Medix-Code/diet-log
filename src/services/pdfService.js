/**
 * @file pdfService.js
 * @description Lògica per generar, omplir i descarregar documents PDF de dietes.
 * @module pdfService
 */

// Importacions de mòduls interns
import { getCurrentTab } from "../ui/tabs.js";
import { showToast } from "../ui/toast.js";
import { handleSaveDietWithPossibleOverwrite } from "./dietService.js";
import { gatherAllData } from "./formService.js";
import { validateDadesTab, validateServeisTab } from "../utils/validation.js";
// Importacions del servei PWA
import {
  isAppInstalled,
  requestInstallPromptAfterAction,
} from "./pwaService.js";

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
  const empresa = generalData?.empresa;
  if (empresa === "empresa2" && PDF_SETTINGS.TEMPLATE_URLS.EMPRESA_2) {
    return PDF_SETTINGS.TEMPLATE_URLS.EMPRESA_2;
  }
  return PDF_SETTINGS.TEMPLATE_URLS.DEFAULT;
}

function handleValidationUIErrors(isDadesValid, isServeisValid) {
  const dadesTabElement = document.getElementById(DOM_IDS.DADES_TAB);
  const serveisTabElement = document.getElementById(DOM_IDS.SERVEIS_TAB);

  dadesTabElement?.classList.remove(CSS_CLASSES.ERROR_TAB);
  serveisTabElement?.classList.remove(CSS_CLASSES.ERROR_TAB);

  let toastMessage = "";

  if (!isDadesValid && !isServeisValid) {
    toastMessage =
      "Completa els camps obligatoris a les pestanyes Datos i Servicios.";
    dadesTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
    serveisTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else if (!isDadesValid) {
    toastMessage = "Completa els camps obligatoris a la pestanya Datos.";
    dadesTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  } else if (!isServeisValid) {
    toastMessage = "Completa els camps obligatoris a la pestanya Servicios.";
    serveisTabElement?.classList.add(CSS_CLASSES.ERROR_TAB);
  }

  if (toastMessage) {
    showToast(toastMessage, "error");
  }
}

// --- Funcions Principals ---

export async function fillPdf(data, servicesData) {
  if (!data || !Array.isArray(servicesData)) {
    throw new Error("Dades invàlides proporcionades a fillPdf.");
  }

  if (!window.PDFLib || !window.PDFLib.PDFDocument) {
    console.error(
      "PDFLib no està disponible a window.PDFLib. Assegura't que s'ha carregat correctament."
    );
    throw new Error("La llibreria PDFLib no està carregada.");
  }
  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;

  try {
    const pdfTemplateUrl = getPdfTemplateUrl(data);
    const pdfBytes = await fetch(pdfTemplateUrl).then((res) => {
      if (!res.ok)
        throw new Error(
          `No s'ha pogut carregar la plantilla PDF: ${res.statusText}`
        );
      return res.arrayBuffer();
    });

    const pdfDoc = await PDFDocument.load(pdfBytes);
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const page = pdfDoc.getPages()[0];

    const defaultTextColorRgbFn = (hexColor) => {
      const c = hexToRgb(hexColor);
      return rgb(c.r / 255, c.g / 255, c.b / 255);
    };
    const serviceNumberColorRgb = defaultTextColorRgbFn(
      PDF_SETTINGS.SERVICE_NUMBER_COLOR
    );

    // 1) Camps Generals
    Object.entries(generalFieldCoordinates).forEach(([field, coords]) => {
      let value = data[field] || "";
      if (field === "date" && value) value = formatDateForPdf(value);

      if (field === "vehicleNumber" && typeof value === "string") {
        value = value.toUpperCase();
      }

      // Aplicar TitleCase i després truncament per a person1 i person2
      if (
        (field === "person1" || field === "person2") &&
        typeof value === "string"
      ) {
        // Primer, convertim a Title Case
        value = toTitleCase(value);

        // Després, trunquem si excedeix el límit
        if (value.length > PDF_SETTINGS.MAX_SIGNATURE_NAME_LENGTH) {
          value =
            value.substring(0, PDF_SETTINGS.MAX_SIGNATURE_NAME_LENGTH - 3) + // <<< LÒGICA DE TRUNCAMENT RESTAURADA
            "...";
        }
      }

      page.drawText(value, {
        x: coords.x,
        y: coords.y,
        size: coords.size,
        font: helveticaFont,
        color: defaultTextColorRgbFn(coords.color),
      });
    });

    servicesData.forEach((service, index) => {
      const yOffset = index * PDF_SETTINGS.SERVICE_Y_OFFSET;
      const serviceMode = service.mode || "3.6";

      // Iterem sobre les claus de baseServiceFieldCoordinates per assegurar l'ordre correcte
      // i gestionar endTime de manera especial.
      const fieldKeys = Object.keys(baseServiceFieldCoordinates);

      for (const field of fieldKeys) {
        // Ignorem les coordenades especials del prefix/hora amb prefix en aquest bucle principal.
        // Les utilitzarem específicament quan processem 'endTimeNormal'.
        if (
          field === "endTimeModeText" ||
          field === "endTimeValueWhenPrefixed"
        ) {
          continue;
        }

        const coords = baseServiceFieldCoordinates[field];
        let value = service[field] || ""; // Per defecte, agafem el valor del camp corresponent
        let currentTextColorRgb = defaultTextColorRgbFn(coords.color);

        if (serviceMode !== "3.6") {
          if (field === "destination" || field === "destinationTime") {
            if (!value.trim()) {
              value = PDF_SETTINGS.EMPTY_FIELD_PLACEHOLDER;
            }
          }
        }

        if (field === "serviceNumber") {
          currentTextColorRgb = serviceNumberColorRgb;
        }

        // Gestió especial per a l'hora final
        if (field === "endTimeNormal") {
          // Hem canviat el nom del camp original a 'endTimeNormal'
          const endTimeValueFromService = (service.endTime || "").trim(); // L'hora real del servei

          if (serviceMode !== "3.6" && endTimeValueFromService) {
            // Mode restringit i hi ha hora: dibuixem el prefix i l'hora per separat

            // 1. Dibuixa el text del mode (ex: "3.11")
            const modeTextCoords = baseServiceFieldCoordinates.endTimeModeText;
            page.drawText(serviceMode, {
              // Dibuixa el text del mode ("3.11", "3.22")
              x: modeTextCoords.x,
              y: modeTextCoords.y - yOffset,
              size: modeTextCoords.size,
              font: helveticaFont,
              color: defaultTextColorRgbFn(modeTextCoords.color), // Color vermell fosc
            });

            // 2. Dibuixa l'hora (ex: "19:00")
            const timeValCoords =
              baseServiceFieldCoordinates.endTimeValueWhenPrefixed;
            page.drawText(endTimeValueFromService, {
              // Dibuixa només l'hora
              x: timeValCoords.x,
              y: timeValCoords.y - yOffset,
              size: timeValCoords.size,
              font: helveticaFont,
              color: defaultTextColorRgbFn(timeValCoords.color), // Color negre per defecte
            });
            // Com que ja hem dibuixat les dues parts, podem saltar la crida genèrica per a 'endTimeNormal'
            continue; // Passa al següent camp del bucle
          } else {
            // Mode 3.6, o mode restringit però no hi ha hora final:
            // Prepara el valor per a la crida genèrica (serà l'hora o buit).
            if (!endTimeValueFromService && serviceMode !== "3.6") {
              value = PDF_SETTINGS.EMPTY_FIELD_PLACEHOLDER;
            } else {
              value = endTimeValueFromService; // Utilitza l'hora (o buit si era buit originalment)
            }
            // La crida genèrica page.drawText de sota s'encarregarà de dibuixar 'value'
            // a les coordenades de 'endTimeNormal'.
          }
        }

        // Dibuix genèric per a la resta de camps, o per 'endTimeNormal' en els casos no coberts a dalt
        page.drawText(value, {
          x: coords.x,
          y: coords.y - yOffset,
          size: coords.size,
          font: helveticaFont,
          color: currentTextColorRgb,
        });
      }
    });

    const embedAndDrawSignature = async (signatureData, coords) => {
      if (signatureData) {
        try {
          const pngImage = await pdfDoc.embedPng(signatureData);
          page.drawImage(pngImage, {
            x: coords.x,
            y: coords.y,
            width: PDF_SETTINGS.SIGNATURE_WIDTH,
            height: PDF_SETTINGS.SIGNATURE_HEIGHT,
          });
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
    const pageWidth = page.getWidth();
    const xCentered = (pageWidth - textWidth) / 2;

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
    // >>> CANVI 1: Millorem el missatge inicial <<<
    console.info("Iniciant generació de PDF...");
    showToast("Generando PDF...", "info"); // Aquest missatge està bé per indicar que comença el procés

    // 2. Recollida de dades (es manté igual)
    const { generalData, servicesData } = gatherAllData();
    if (!generalData || !servicesData) {
      throw new Error("No se han podido recoger los datos del formulario.");
    }

    // 3. Generació dels bytes del PDF (es manté igual)
    const pdfBytes = await fillPdf(generalData, servicesData);

    // 4. Preparació i inici de la descàrrega
    const fileName = buildPdfFileName(generalData.date, generalData.dietType);
    const blob = new Blob([pdfBytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click(); // S'inicia el procés de descàrrega del navegador
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(url), 500);
    showToast("PDF generado correctamente.", "success");
    console.info(`Se ha iniciado el proceso de descarga para "${fileName}".`);

    // 5. Desat de la dieta
    try {
      await handleSaveDietWithPossibleOverwrite();
    } catch (saveError) {
      console.error(
        "Error en desar la dieta després de generar el PDF:",
        saveError
      );
      showToast(
        "PDF generado, pero hubo un error al guardar la dieta.",
        "warning"
      );
    }

    if (typeof requestInstallPromptAfterAction === "function") {
      requestInstallPromptAfterAction();
      console.info(
        "Notificació enviada a pwaService per possible prompt d'instal·lació."
      );
    } else {
      console.warn(
        "La funció 'requestInstallPromptAfterAction' no està disponible a pwaService."
      );
    }
    // 6. Notificació PWA
  } catch (error) {
    console.error("Error durant generateAndDownloadPdf:", error);
    showToast(
      `Error al generar el PDF: ${error.message || "Error desconocido"}`,
      "error"
    );
    document
      .getElementById(DOM_IDS.DADES_TAB)
      ?.classList.remove(CSS_CLASSES.ERROR_TAB);
    document
      .getElementById(DOM_IDS.SERVEIS_TAB)
      ?.classList.remove(CSS_CLASSES.ERROR_TAB);
  }
}
