// inject-version.js
const fs = require("fs");
const path = require("path");

// 1. Leemos la versión del archivo package.json
const packageJson = require("./package.json");
const appVersion = packageJson.version;

if (!appVersion) {
  console.error(
    "Error: No se ha encontrado la versión en el archivo package.json"
  );
  process.exit(1);
}
console.log(`Versión de la app encontrada: ${appVersion}`);

// 2. Definimos un array con los archivos que queremos modificar
const filesToPatch = [
  path.resolve(__dirname, "index.html"),
  path.resolve(__dirname, "service-worker.js"),
];

// 3. Expresión regular para detectar números de versión (ej: "1.2.7", "2.0.1", etc.)
const versionRegex = /(\d+(?:\.\d+)+)/g;

// 4. Función para extraer la primera versión encontrada en un archivo (excluyendo CDN)
function extractFirstVersion(content) {
  const lines = content.split("\n");
  const nonCdnLines = lines.filter(
    (line) =>
      !line.includes("cdnjs") &&
      !line.includes("fonts.googleapis") &&
      !line.includes("unpkg") &&
      !line.includes("jsdelivr")
  );
  const joinedContent = nonCdnLines.join("\n");
  const match = joinedContent.match(versionRegex);
  return match ? match[0] : null;
}

// 5. Recorremos cada archivo y reemplazamos versionesa propias (excluyendo CDN)
filesToPatch.forEach((filePath) => {
  try {
    // Leemos el contenido del archivo
    let content = fs.readFileSync(filePath, "utf8");

    // Extraemos la primera versión encontrada
    const oldVersion = extractFirstVersion(content);

    if (oldVersion) {
      // Buscamos versiones en líneas relacionadas con la app (no URLs de CDN)
      const lines = content.split("\n");
      let updated = false;
      const newContent = lines
        .map((line) => {
          // Evitar cambios en URLs de CDN que contengan versiones
          if (
            (line.includes("cdnjs") ||
              line.includes("fonts.googleapis") ||
              line.includes("unpkg") ||
              line.includes("jsdelivr")) &&
            line.includes(oldVersion)
          ) {
            // Conservar línea original para CDN
            return line;
          } else if (line.includes(oldVersion)) {
            // Actualizar solo versiones de la app
            updated = true;
            return line.replace(new RegExp(oldVersion, "g"), appVersion);
          }
          return line;
        })
        .join("\n");

      // Solo escribimos si ha habido cambios reales
      if (updated) {
        fs.writeFileSync(filePath, newContent, "utf8");
        console.log(
          `Versión actualizada: ${oldVersion} → ${appVersion} en ${filePath}`
        );
      } else {
        console.log(
          `No se encontraron versiones que actualizar en ${filePath}`
        );
      }
    } else {
      console.warn(`AVISO: No se ha encontrado ninguna versión en ${filePath}`);
    }
  } catch (error) {
    console.error(`Error procesando el archivo ${filePath}:`, error);
    process.exit(1);
  }
});
