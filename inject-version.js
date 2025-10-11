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
const versionRegex = /(\d+\.\d+\.\d+)/;

// 4. Recorremos cada archivo y reemplazamos versiones propias
filesToPatch.forEach((filePath) => {
  try {
    // Leemos el contenido del archivo
    let content = fs.readFileSync(filePath, "utf8");

    const lines = content.split("\n");
    let updated = false;
    let oldVersion = null;

    const newContent = lines
      .map((line) => {
        // Solo actualizar líneas que contengan "version-text", "const VERSION" o "const CACHE_VERSION"
        if (
          line.includes('class="version-text"') ||
          line.includes("const VERSION =") ||
          line.includes("const CACHE_VERSION")
        ) {
          const match = line.match(versionRegex);
          if (match && match[0] !== appVersion) {
            if (!oldVersion) oldVersion = match[0];
            updated = true;
            return line.replace(match[0], appVersion);
          }
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
      console.log(`No se encontraron versiones que actualizar en ${filePath}`);
    }
  } catch (error) {
    console.error(`Error procesando el archivo ${filePath}:`, error);
    process.exit(1);
  }
});
