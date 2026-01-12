import { logger } from "../../utils/logger.js";

export const LAYOUT = {
  OUTER_MARGIN: 55,
  INNER_PADDING: 10,
};

export const PDF_SETTINGS = {
  TEMPLATE_URLS: {
    DEFAULT: "./dieta.pdf",
  },
  SERVICE_Y_OFFSET: 82,
  SIGNATURE_WIDTH: 100,
  SIGNATURE_HEIGHT: 50,
  WATERMARK_TEXT: "misdietas.com",
  DEFAULT_FILENAME: "dieta.pdf",
  SERVICE_NUMBER_COLOR: "#004aad",
  MODE_PREFIX_TEXT_COLOR: "#8B0000",
  MAX_SIGNATURE_NAME_LENGTH: 31,
  MAX_ORIGIN_LENGTH: 30, // Màxim caràcters per origen
  MAX_DESTINATION_LENGTH: 30, // Màxim caràcters per destí
};

export const FIELD_COORDINATES = {
  general: {
    date: { x: 155, y: 732, size: 16, color: "#000000" },
    vehicleNumber: { x: 441, y: 732, size: 16, color: "#000000" },
    person1: { x: 65, y: 368, size: 16, color: "#000000" },
    person2: { x: 310, y: 368, size: 16, color: "#000000" },
  },
  service: {
    serviceNumber: { x: 130, y: 715, size: 16, color: "#000000" },
    origin: { x: 229, y: 698, size: 14, color: "#000000" },
    originTime: { x: 441, y: 698, size: 16, color: "#000000" },
    destination: { x: 229, y: 683, size: 14, color: "#000000" },
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
    title: { x: 65, y: 250, size: 16, color: "#000000" },
    lineHeight: 18,
    maxWidth: 465,
    start: { x: 65, y: 230, size: 16, color: "#333333" },
  },
  fixedText: {
    website: { x: 250, y: 20, size: 6, color: "#EEEEEE" },
  },
};

const log = logger.withScope("PdfTemplate");

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
  return Number.isNaN(bigint)
    ? { r: 0, g: 0, b: 0 }
    : { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

/**
 * Trunca text si sobrepassa la llargada màxima
 * Afegeix "..." si s'ha truncat
 */
function truncateText(text, maxLength) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

export function formatDateForPdf(dateString) {
  if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return "";
  const [yyyy, mm, dd] = dateString.split("-");
  return `${dd}/${mm}/${yyyy}`;
}

function getPdfTemplateUrl() {
  return PDF_SETTINGS.TEMPLATE_URLS.DEFAULT;
}

export async function fillPdf(generalData, servicesData) {
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

  servicesData.forEach((service, index) => {
    const yOffset = index * PDF_SETTINGS.SERVICE_Y_OFFSET;
    const serviceMode = service.mode || "3.6";

    page.drawText(service.serviceNumber || "", {
      ...FIELD_COORDINATES.service.serviceNumber,
      y: FIELD_COORDINATES.service.serviceNumber.y - yOffset,
      font: helveticaFont,
      color: rgbFromHex(PDF_SETTINGS.SERVICE_NUMBER_COLOR),
    });

    const originText = truncateText(
      service.origin || "",
      PDF_SETTINGS.MAX_ORIGIN_LENGTH
    );
    const originSize =
      originText.length > 23 ? 13 : FIELD_COORDINATES.service.origin.size;

    page.drawText(originText, {
      ...FIELD_COORDINATES.service.origin,
      y: FIELD_COORDINATES.service.origin.y - yOffset,
      size: originSize,
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
      const destinationText = truncateText(
        service.destination || "",
        PDF_SETTINGS.MAX_DESTINATION_LENGTH
      );
      const destinationSize =
        destinationText.length > 23
          ? 13
          : FIELD_COORDINATES.service.destination.size;

      page.drawText(destinationText, {
        ...FIELD_COORDINATES.service.destination,
        y: FIELD_COORDINATES.service.destination.y - yOffset,
        size: destinationSize,
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
        log.warn("No s'ha pogut incrustar una signatura.", error);
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

  const PAGE_WIDTH = page.getWidth();
  const LEFT_BOUNDARY = LAYOUT.OUTER_MARGIN + LAYOUT.INNER_PADDING;
  const RIGHT_BOUNDARY =
    PAGE_WIDTH - (LAYOUT.OUTER_MARGIN + LAYOUT.INNER_PADDING);

  const notes = servicesData
    .map((service) => ({
      num: service.serviceNumber || "",
      text: (service.notes || "").trim(),
    }))
    .filter((entry) => entry.num && entry.text);

  if (notes.length) {
    const sepY = 275;
    page.drawLine({
      start: { x: LAYOUT.OUTER_MARGIN, y: sepY },
      end: { x: PAGE_WIDTH - LAYOUT.OUTER_MARGIN, y: sepY },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });

    const title = notes.length === 1 ? "Observació" : "Observacions";
    page.drawText(title, {
      ...FIELD_COORDINATES.notesSection.title,
      font: helveticaFont,
      color: rgbFromHex(FIELD_COORDINATES.notesSection.title.color),
    });

    let y = FIELD_COORDINATES.notesSection.start.y;
    const size = FIELD_COORDINATES.notesSection.start.size;
    const lineHeight = FIELD_COORDINATES.notesSection.lineHeight;
    const bodyColor = rgbFromHex(FIELD_COORDINATES.notesSection.start.color);

    notes.forEach(({ num, text }) => {
      if (y < 40) return;

      const prefix = `Servei ${num}: `;
      page.drawText(prefix, {
        x: LEFT_BOUNDARY,
        y,
        font: helveticaFont,
        size,
        color: rgbFromHex(PDF_SETTINGS.SERVICE_NUMBER_COLOR),
      });

      const prefixWidth = helveticaFont.widthOfTextAtSize(prefix, size);
      let currentX = LEFT_BOUNDARY + prefixWidth;

      text.split(" ").forEach((word) => {
        if (!word) return;

        const wordWidth = helveticaFont.widthOfTextAtSize(`${word} `, size);

        if (currentX + wordWidth > RIGHT_BOUNDARY) {
          y -= lineHeight;
          currentX = LEFT_BOUNDARY;
        }

        page.drawText(`${word} `, {
          x: currentX,
          y,
          font: helveticaFont,
          size,
          color: bodyColor,
        });

        currentX += wordWidth;
      });

      y -= lineHeight * 1.5;
    });
  }

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

  const dietDate = new Date(generalData.date);
  if (!Number.isNaN(dietDate.getTime())) {
    pdfDoc.setCreationDate(dietDate);
    pdfDoc.setModificationDate(dietDate);
  }

  return await pdfDoc.save({
    permissions: {
      modifying: false,
      copying: false,
    },
  });
}
