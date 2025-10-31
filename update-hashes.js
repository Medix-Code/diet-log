#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");

/**
 * Calcula el hash SHA-384 d'un fitxer
 */
function calculateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash("sha384");
  hashSum.update(fileBuffer);
  return hashSum.digest("hex");
}

console.log("📝 Actualitzant hashes d'integritat al Service Worker...");

// Fitxers a verificar
const files = {
  "/dist/bundle.js?v=2.5.3": "dist/bundle.js",
  "/css/main.min.css?v=2.3.4": "css/main.min.css",
};

// Calcular hashes
const hashes = {};
for (const [key, filePath] of Object.entries(files)) {
  if (fs.existsSync(filePath)) {
    hashes[key] = calculateFileHash(filePath);
    console.log(`✅ ${key}: ${hashes[key]}`);
  } else {
    console.warn(`⚠️  Fitxer no trobat: ${filePath}`);
  }
}

// Llegir service-worker.js
const swPath = "service-worker.js";
if (!fs.existsSync(swPath)) {
  console.error(`❌ No s'ha trobat ${swPath}`);
  process.exit(1);
}

let swContent = fs.readFileSync(swPath, "utf8");

// Actualitzar RESOURCE_INTEGRITY
const resourceIntegrityRegex = /const RESOURCE_INTEGRITY = \{[^}]+\}/s;
const newResourceIntegrity = `const RESOURCE_INTEGRITY = {
  "/dist/bundle.js?v=2.5.3":
    "${hashes["/dist/bundle.js?v=2.5.3"]}",
  "/css/main.min.css?v=2.3.4":
    "${hashes["/css/main.min.css?v=2.3.4"]}",
}`;

swContent = swContent.replace(resourceIntegrityRegex, newResourceIntegrity);

// Guardar
fs.writeFileSync(swPath, swContent);
console.log(`✅ Hashes actualitzats a ${swPath}`);
console.log("🎉 Fet!");
