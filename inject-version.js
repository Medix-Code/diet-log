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
const versionRegex = /(\d+)\.(\d+)\.(\d+)/g;

// 4. Función para extraer la primera versión encontrada en un archivo
function extractFirstVersion(content) {
  const match = content.match(versionRegex);
  return match ? match[0] : null;
}

// 5. Recorremos cada archivo y reemplazamos cualquier versión por la nueva
filesToPatch.forEach((filePath) => {
  try {
    // Leemos el contenido del archivo
    let content = fs.readFileSync(filePath, "utf8");

    // Extraemos la primera versión encontrada
    const oldVersion = extractFirstVersion(content);

    if (oldVersion) {
      // Reemplazamos todas las ocurrencias de la versión antigua por la nueva
      const updatedContent = content.replace(
        new RegExp(oldVersion, "g"),
        appVersion
      );

      // Solo escribimos si ha habido cambios
      if (updatedContent !== content) {
        fs.writeFileSync(filePath, updatedContent, "utf8");
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
