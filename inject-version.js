// inject-version.js
const fs = require("fs");
const path = require("path");

// 1. Llegim la versió del package.json
const packageJson = require("./package.json");
const appVersion = packageJson.version;

if (!appVersion) {
  console.error("Error: No s'ha trobat la versió al package.json");
  process.exit(1);
}
console.log(`Versió de l'app trobada: ${appVersion}`);

// Array de fitxers a modificar amb el seu placeholder
const filesToPatch = [
  {
    path: path.resolve(__dirname, "index.html"),
    placeholder: "__APP_VERSION__",
  },
  {
    path: path.resolve(__dirname, "service-worker.js"),
    placeholder: "__APP_VERSION__",
  },
];

// 2. Iterem i modifiquem cada fitxer
filesToPatch.forEach((fileInfo) => {
  try {
    let content = fs.readFileSync(fileInfo.path, "utf8");

    const placeholderRegex = new RegExp(fileInfo.placeholder, "g");

    if (placeholderRegex.test(content)) {
      content = content.replace(placeholderRegex, appVersion);
      fs.writeFileSync(fileInfo.path, content, "utf8");
      console.log(
        `Versió ${appVersion} injectada correctament a ${fileInfo.path}`
      );
    } else {
      console.warn(
        `AVÍS: El placeholder "${fileInfo.placeholder}" no s'ha trobat a ${fileInfo.path}.`
      );
    }
  } catch (error) {
    console.error(`Error processant el fitxer ${fileInfo.path}:`, error);
    process.exit(1);
  }
});
