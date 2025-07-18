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
  {
    path: path.resolve(__dirname, "index.html"),
    placeholder: "__APP_VERSION__", // El texto que buscaremos y reemplazaremos
  },
  {
    path: path.resolve(__dirname, "service-worker.js"),
    placeholder: "__APP_VERSION__",
  },
];

// 3. Recorremos el array y modificamos cada archivo
filesToPatch.forEach((fileInfo) => {
  try {
    // Leemos el contenido del archivo
    let content = fs.readFileSync(fileInfo.path, "utf8");

    // Creamos una expresión regular para buscar el placeholder globalmente
    const placeholderRegex = new RegExp(fileInfo.placeholder, "g");

    // Comprobamos si el placeholder existe en el archivo antes de modificarlo
    if (placeholderRegex.test(content)) {
      // Reemplazamos todas las ocurrencias del placeholder por la versión real
      content = content.replace(placeholderRegex, appVersion);

      // Escribimos el contenido modificado de vuelta en el archivo
      fs.writeFileSync(fileInfo.path, content, "utf8");

      console.log(
        `Versión ${appVersion} inyectada correctamente en ${fileInfo.path}`
      );
    } else {
      console.warn(
        `AVISO: El placeholder "${fileInfo.placeholder}" no se ha encontrado en ${fileInfo.path}.`
      );
    }
  } catch (error) {
    console.error(`Error procesando el archivo ${fileInfo.path}:`, error);
    process.exit(1);
  }
});
