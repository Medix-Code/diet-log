/**
 * @file pdfService.js
 * @description Genera i descarrega PDF de dietes amb validacions i marges simètrics per a la secció de notes.
 * @module pdfService
 */

mport { pseudoId } from "../utils/pseudoId.js";
import { showToast } from "../ui/toast.js";
import { gatherAllData } from "./formService.js";
import { validateDadesTab, validateServeisTab } from "../utils/validation.js";
import { requestInstallPromptAfterAction } from "./pwaInstallHandler.js";
import { getDiet } from "../db/indexedDbDietRepository.js";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Control global de marges exteriors de la plantilla i de la separació interna
 * del text respecte la línia vertical.  D’aquesta manera el marge dret queda
 * sempre idèntic al marge esquerre sense dependre de valors màgics.
 */
const LAYOUT = {
  OUTER_MARGIN: 55,
  INNER_PADDING: 10,
};

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
  },
  SERVICE_Y_OFFSET: 82,
  SIGNATURE_WIDTH: 100,
  SIGNATURE_HEIGHT: 50,
  WATERMARK_TEXT: "misdietas.com",
  DEFAULT_FILENAME: "dieta.pdf",
  SERVICE_NUMBER_COLOR: "#004aad",
  MODE_PREFIX_TEXT_COLOR: "#8B0000",
  MAX_SIGNATURE_NAME_LENGTH: 31,
};

const FIELD_COORDINATES = {
  general: {
    date: { x: 155, y: 732, size: 16, color: "#000000" },
    vehicleNumber: { x: 441, y: 732, size: 16, color: "#000000" },
    person1: { x: 65, y: 368, size: 16, color: "#000000" },
    person2: { x: 310, y: 368, size: 16, color: "#000000" },
  },
  service: {
    serviceNumber: { x: 130, y: 715, size: 16, color: "#000000" },
    origin: { x: 232, y: 698, size: 16, color: "#000000" },
    originTime: { x: 441, y: 698, size: 16, color: "#000000" },
    destination: { x: 232, y: 683, size: 16, color: "#000000" },
    destinationTime: { x: 441, y: 681, size: 16, color: "#000000" },
    endTimeNormal: { x: 441, y: 665, size: 16, color: "#000000" },
    endTimeModeText: {
      x: 390,
      y: 665,
      size: 16,
      color: PDF_SETTINGS.MODE_PREFIX_TEXT_COLOR,
    },
    endTimeValueWhenPrefixed: { x: 441, y: 665, size: 16, color: "#000000" },
  },
  signature: {
    conductor: { x: 125, y: 295, width: 100, height: 50 },
    ayudante: { x: 380, y: 295, width: 100, height: 50 },
  },
  notesSection: {
    // Els valors x i maxWidth seran recalculats dinàmicament a partir de LAYOUT
    title: { x: 65, y: 250, size: 16, color: "#000000" },
    lineHeight: 18,
    maxWidth: 465, // Mantingut per compatibilitat; serà sobreescrit a fillPdf
    start: { x: 65, y: 230, size: 16, color: "#333333" },
  },
  fixedText: {
    website: { x: 250, y: 20, size: 6, color: "#EEEEEE" },
  },
};

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

function toTitleCase(str) {
  if (!str || typeof str !== "string" || str.trim() === "") return "";
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      word.includes("-")
        ? word
            .split("-")
            .map((part) =>
              part
                ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
                : ""
            )
            .join("-")
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    )
    .join(" ");
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return { r: 0, g: 0, b: 0 };
  const sanitizedHex = hex.replace("#", "");
  if (sanitizedHex.length !== 6) return { r: 0, g: 0, b: 0 };
  const bigint = parseInt(sanitizedHex, 16);
  return isNaN(bigint)
    ? { r: 0, g: 0, b: 0 }
    : { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function formatDateForPdf(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return "";
  const [yyyy, mm, dd] = dateString.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Divideix textos llargs respectant salts de línia manuals (\n) i ajustant‑los
 * automàticament a l’amplada màxima.
 */
function wrapText(text, font, size, maxWidth) {
  const manualLines = text.split("\n");
  const finalLines = [];

  manualLines.forEach((lineFragment) => {
    if (lineFragment.trim() === "") {
      finalLines.push("");
      return;
    }
    const words = lineFragment.split(" ");
    if (!words.length) return;

    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = `${currentLine} ${word}`;
      const testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        finalLines.push(currentLine);
        currentLine = word;
      }
    }
    finalLines.push(currentLine);
  });

  return finalLines;
}

function getPdfTemplateUrl() {
  // Ara mateix només un tipus de plantilla, però així queda preparat.
  return PDF_SETTINGS.TEMPLATE_URLS.DEFAULT;
}

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
async function fillPdf(generalData, servicesData) {
  if (!generalData || !Array.isArray(servicesData))
    throw new Error("Dades invàlides.");
  if (!window.PDFLib) throw new Error("PDFLib no carregada.");

  const { PDFDocument, StandardFonts, rgb } = window.PDFLib;
  const pdfTemplateUrl = getPdfTemplateUrl();
  const pdfBytes = await fetch(pdfTemplateUrl).then((res) => res.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPages()[0];
  const rgbFromHex = (hex) => {
    const { r, g, b } = hexToRgb(hex);
    return rgb(r / 255, g / 255, b / 255);
  };

  // ---------------------------------------------------------------------------
  // Camps generals
  // ---------------------------------------------------------------------------
  Object.entries(FIELD_COORDINATES.general).forEach(([field, coords]) => {
    let value = generalData[field] || "";
    if (field === "date") value = formatDateForPdf(value);
    if (field === "vehicleNumber") value = value.toUpperCase();
    if (field === "person1" || field === "person2") {
      value = toTitleCase(value);
      if (value.length > PDF_SETTINGS.MAX_SIGNATURE_NAME_LENGTH) {
        value =
          value.slice(0, PDF_SETTINGS.MAX_SIGNATURE_NAME_LENGTH - 3) + "...";
      }
    }
    page.drawText(value, {
      ...coords,
      font: helveticaFont,
      color: rgbFromHex(coords.color),
    });
  });

  // ---------------------------------------------------------------------------
  // Camps per servei
  // ---------------------------------------------------------------------------
  servicesData.forEach((service, index) => {
    const yOffset = index * PDF_SETTINGS.SERVICE_Y_OFFSET;
    const serviceMode = service.mode || "3.6";

    page.drawText(service.serviceNumber || "", {
      ...FIELD_COORDINATES.service.serviceNumber,
      y: FIELD_COORDINATES.service.serviceNumber.y - yOffset,
      font: helveticaFont,
      color: rgbFromHex(PDF_SETTINGS.SERVICE_NUMBER_COLOR),
    });

    page.drawText(service.origin || "", {
      ...FIELD_COORDINATES.service.origin,
      y: FIELD_COORDINATES.service.origin.y - yOffset,
      font: helveticaFont,
      color: rgbFromHex(FIELD_COORDINATES.service.origin.color),
    });

    page.drawText(service.originTime || "", {
      ...FIELD_COORDINATES.service.originTime,
      y: FIELD_COORDINATES.service.originTime.y - yOffset,
      font: helveticaFont,
      color: rgbFromHex(FIELD_COORDINATES.service.originTime.color),
    });

    if (serviceMode === "3.6") {
      page.drawText(service.destination || "", {
        ...FIELD_COORDINATES.service.destination,
        y: FIELD_COORDINATES.service.destination.y - yOffset,
        font: helveticaFont,
        color: rgbFromHex(FIELD_COORDINATES.service.destination.color),
      });
      page.drawText(service.destinationTime || "", {
        ...FIELD_COORDINATES.service.destinationTime,
        y: FIELD_COORDINATES.service.destinationTime.y - yOffset,
        font: helveticaFont,
        color: rgbFromHex(FIELD_COORDINATES.service.destinationTime.color),
      });
    }

    const endTimeValue = (service.endTime || "").trim();
    if (serviceMode !== "3.6" && endTimeValue) {
      page.drawText(serviceMode, {
        ...FIELD_COORDINATES.service.endTimeModeText,
        y: FIELD_COORDINATES.service.endTimeModeText.y - yOffset,
        font: helveticaFont,
        color: rgbFromHex(FIELD_COORDINATES.service.endTimeModeText.color),
      });
      page.drawText(endTimeValue, {
        ...FIELD_COORDINATES.service.endTimeValueWhenPrefixed,
        y: FIELD_COORDINATES.service.endTimeValueWhenPrefixed.y - yOffset,
        font: helveticaFont,
        color: rgbFromHex(
          FIELD_COORDINATES.service.endTimeValueWhenPrefixed.color
        ),
      });
    } else {
      page.drawText(endTimeValue, {
        ...FIELD_COORDINATES.service.endTimeNormal,
        y: FIELD_COORDINATES.service.endTimeNormal.y - yOffset,
        font: helveticaFont,
        color: rgbFromHex(FIELD_COORDINATES.service.endTimeNormal.color),
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Signatures
  // ---------------------------------------------------------------------------
  const embedSignature = async (signatureData, coords) => {
    const isValidSignature =
      typeof signatureData === "string" &&
      signatureData.startsWith("data:image/png;base64,") &&
      signatureData.length > "data:image/png;base64,".length;

    if (isValidSignature) {
      try {
        const pngImage = await pdfDoc.embedPng(signatureData);
        page.drawImage(pngImage, { ...coords });
      } catch (error) {
        console.warn(
          `No s'ha pogut incrustar una signatura. Error: ${error.message}`
        );
      }
    }
  };

  await Promise.all([
    embedSignature(
      generalData.signatureConductor,
      FIELD_COORDINATES.signature.conductor
    ),
    embedSignature(
      generalData.signatureAjudant,
      FIELD_COORDINATES.signature.ayudante
    ),
  ]);

  // ---------------------------------------------------------------------------
  // Secció de notes (marges simètrics + sagnat penjant)
  // ---------------------------------------------------------------------------
  const PAGE_WIDTH = page.getWidth();
  const LEFT_BOUNDARY = LAYOUT.OUTER_MARGIN + LAYOUT.INNER_PADDING; // 65 pt
  const RIGHT_BOUNDARY =
    PAGE_WIDTH - (LAYOUT.OUTER_MARGIN + LAYOUT.INNER_PADDING);

  const notes = servicesData
    .map((s) => ({ num: s.serviceNumber || "", text: (s.notes || "").trim() }))
    .filter((n) => n.num && n.text);

  if (notes.length) {
    // línia horitzontal separadora
    const sepY = 275;
    page.drawLine({
      start: { x: LAYOUT.OUTER_MARGIN, y: sepY },
      end: { x: PAGE_WIDTH - LAYOUT.OUTER_MARGIN, y: sepY },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    // títol
    const title = notes.length === 1 ? "Observació" : "Observacions";
    page.drawText(title, {
      ...FIELD_COORDINATES.notesSection.title,
      font: helveticaFont,
      color: rgbFromHex(FIELD_COORDINATES.notesSection.title.color),
    });

    // paràmetres de text
    let y = FIELD_COORDINATES.notesSection.start.y;
    const size = FIELD_COORDINATES.notesSection.start.size;
    const lineH = FIELD_COORDINATES.notesSection.lineHeight;
    const bodyCol = rgbFromHex(FIELD_COORDINATES.notesSection.start.color);

    notes.forEach(({ num, text }) => {
      if (y < 40) return; // no escriure massa avall

      // prefix “Servei 123: ”
      const prefix = `Servei ${num}: `;
      const prefixW = helveticaFont.widthOfTextAtSize(prefix, size);
      const indentX = LEFT_BOUNDARY + prefixW; // punt de sagnat

      page.drawText(prefix, {
        x: LEFT_BOUNDARY,
        y,
        font: helveticaFont,
        size,
        color: rgbFromHex(PDF_SETTINGS.SERVICE_NUMBER_COLOR),
      });

      // recorrem paraules amb control de marge dret
      let cx = indentX;
      text.split(" ").forEach((word) => {
        if (!word) return;
        const w = helveticaFont.widthOfTextAtSize(word + " ", size);

        if (cx + w > RIGHT_BOUNDARY) {
          // passa del marge dret
          y -= lineH;
          cx = indentX; // nova línia amb sagnat penjant
        }
        page.drawText(word + " ", {
          x: cx,
          y,
          font: helveticaFont,
          size,
          color: bodyCol,
        });
        cx += w;
      });

      y -= lineH * 1.5; // espai abans de la nota següent
    });
  }

  // ---------------------------------------------------------------------------
  // Marca d'aigua
  // ---------------------------------------------------------------------------
  const watermarkText = PDF_SETTINGS.WATERMARK_TEXT;
  const textSize = FIELD_COORDINATES.fixedText.website.size;
  const textWidth = helveticaFont.widthOfTextAtSize(watermarkText, textSize);
  page.drawText(watermarkText, {
    x: (page.getWidth() - textWidth) / 2,
    y: FIELD_COORDINATES.fixedText.website.y,
    size: textSize,
    font: helveticaFont,
    color: rgbFromHex(FIELD_COORDINATES.fixedText.website.color),
  });

  // ---------------------------------------------------------------------------
  // Metadades del PDF
  // ---------------------------------------------------------------------------
  const datePart = formatDateForPdf(generalData.date) || "Dieta";
  const typePart =
    generalData.dietType === "lunch"
      ? "Comida"
      : generalData.dietType === "dinner"
      ? "Cena"
      : "";
  const dynamicTitle = `Dieta ${typePart} ${datePart}`
    .trim()
    .replace(/ +/g, " ");

  pdfDoc.setTitle(dynamicTitle);
  pdfDoc.setAuthor("misdietas.com");
  pdfDoc.setSubject("Justificante de dieta de transporte sanitario");
  pdfDoc.setCreator("MisDietas");
  pdfDoc.setKeywords([
    "dieta",
    "justificante",
    "transporte sanitario",
    "tsu",
    "tsnu",
  ]);
  const dataDeLaDieta = new Date(generalData.date);
  if (!isNaN(dataDeLaDieta.getTime())) {
    pdfDoc.setCreationDate(dataDeLaDieta);
    pdfDoc.setModificationDate(dataDeLaDieta);
  }

  // ---------------------------------------------------------------------------
  // Seguretat del PDF
  // ---------------------------------------------------------------------------
  return await pdfDoc.save({
    permissions: {
      modifying: false,
      copying: false,
    },
  });
}

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

    const pdfBytes = await fillPdf(generalData, servicesData);
    const fileName = buildPdfFileName(generalData.date, generalData.dietType);
    downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), fileName);

    showToast("Descàrrega iniciada correctament.", "success");
    requestInstallPromptAfterAction();
  } catch (error) {
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

  try {
    // Nueva lógica: Hash si no es ya un hash de 64 caracteres
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

    const pdfBytes = await fillPdf(generalData, servicesData);
    const fileName = buildPdfFileName(generalData.date, generalData.dietType);
    downloadBlob(new Blob([pdfBytes], { type: "application/pdf" }), fileName);

    showToast("Descarga iniciada correctamente.", "success");
  } catch (error) {
    console.error("Error en downloadDietPDF:", error);
    showToast(
      `Error en la generación del PDF: ${error.message || "Desconocido"}`,
      "error"
    );
  }
}
