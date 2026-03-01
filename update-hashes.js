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
  "/dist/bundle.js?v=2.4.11": "dist/bundle.js",
  "/css/main.min.css?v=2.4.11": "css/main.min.css",
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
  "/dist/bundle.js?v=2.4.11":
    "${hashes["/dist/bundle.js?v=2.4.11"]}",
  "/css/main.min.css?v=2.4.11":
    "${hashes["/css/main.min.css?v=2.4.11"]}",
}`;

swContent = swContent.replace(resourceIntegrityRegex, newResourceIntegrity);

// Guardar
fs.writeFileSync(swPath, swContent);
console.log(`✅ Hashes actualitzats a ${swPath}`);

// Verificar que els hashes s'han escrit correctament
console.log("\n🔍 Verificant integritat dels hashes...");
const updatedContent = fs.readFileSync(swPath, "utf8");
let allHashesValid = true;

for (const [key, expectedHash] of Object.entries(hashes)) {
  // Escapar caràcters especials per la regex
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hashRegex = new RegExp(`"${escapedKey}":\\s*"([a-f0-9]{96})"`);
  const match = updatedContent.match(hashRegex);

  if (!match) {
    console.error(`❌ No s'ha trobat el hash per ${key} al Service Worker`);
    allHashesValid = false;
    continue;
  }

  const writtenHash = match[1];
  if (writtenHash !== expectedHash) {
    console.error(`❌ HASH INCORRECTE per ${key}`);
    console.error(`   Esperat:  ${expectedHash}`);
    console.error(`   Escrit:   ${writtenHash}`);
    allHashesValid = false;
  } else {
    console.log(`✅ Hash verificat per ${key}`);
  }
}

if (!allHashesValid) {
  console.error("\n❌ ERROR: Els hashes no s'han escrit correctament!");
  console.error("   Això podria causar errors al Service Worker en producció.");
  process.exit(1);
}

console.log("\n🎉 Fet! Tots els hashes verificats correctament.");
