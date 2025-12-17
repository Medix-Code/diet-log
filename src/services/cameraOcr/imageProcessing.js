import { logger } from "../../utils/logger.js";

const IMAGE_MAX_DIMENSION = 1500;
const IMAGE_QUALITY = 0.95;
const IMAGE_TYPE = "image/png";

const log = logger.withScope("CameraOCR:ImageProcessing");

function blobFromCanvas(canvas, imageType, imageQuality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("No s'ha pogut generar el blob de la imatge."));
        }
      },
      imageType,
      imageQuality
    );
  });
}

export async function resizeImage(
  file,
  {
    maxDimension = IMAGE_MAX_DIMENSION,
    imageType = IMAGE_TYPE,
    imageQuality = IMAGE_QUALITY,
  } = {}
) {
  const bitmap = await createImageBitmap(file);
  const { width: originalWidth, height: originalHeight } = bitmap;

  if (Math.max(originalWidth, originalHeight) <= maxDimension) {
    bitmap.close();
    return file;
  }

  const ratio = Math.min(
    maxDimension / originalWidth,
    maxDimension / originalHeight
  );
  const width = Math.round(originalWidth * ratio);
  const height = Math.round(originalHeight * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Context 2D no disponible.");
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return blobFromCanvas(canvas, imageType, imageQuality);
}

export async function preprocessImage(
  blob,
  { imageType = IMAGE_TYPE, imageQuality = IMAGE_QUALITY } = {}
) {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Context 2D no disponible.");
  }

  try {
    ctx.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height);
  } catch (drawError) {
    bitmap.close();
    if (drawError.message && drawError.message.includes("detached")) {
      throw new Error("Error al procesar la imagen. Inténtalo de nuevo.");
    }
    throw drawError;
  }

  bitmap.close();

  ctx.filter = "grayscale(100%) contrast(180%) brightness(110%)";
  try {
    ctx.drawImage(canvas, 0, 0);
  } catch (filterDrawError) {
    log.warn("Fallback sense filtres en el preprocessament.", filterDrawError);
  }

  return blobFromCanvas(canvas, imageType, imageQuality);
}

export const IMAGE_PROCESSING = Object.freeze({
  IMAGE_MAX_DIMENSION,
  IMAGE_QUALITY,
  IMAGE_TYPE,
});
