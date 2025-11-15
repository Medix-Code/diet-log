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

console.log("🔍 Verificant hashes d'integritat...\n");

// Fitxers a verificar
const files = {
  "/dist/bundle.js?v=2.5.4": "dist/bundle.js",
  "/css/main.min.css?v=2.3.5": "css/main.min.css",
};

// Service Worker path
const swPath = "service-worker.js";

if (!fs.existsSync(swPath)) {
  console.error(`❌ No s'ha trobat ${swPath}`);
  process.exit(1);
}

const swContent = fs.readFileSync(swPath, "utf8");
let allHashesValid = true;
let errors = [];

for (const [key, filePath] of Object.entries(files)) {
  // Verificar que el fitxer existeix
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Fitxer no trobat: ${filePath}`);
    allHashesValid = false;
    errors.push(`Fitxer no trobat: ${filePath}`);
    continue;
  }

  // Calcular hash real del fitxer
  const actualHash = calculateFileHash(filePath);

  // Extreure hash del Service Worker
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hashRegex = new RegExp(`"${escapedKey}":\\s*"([a-f0-9]{96})"`);
  const match = swContent.match(hashRegex);

  if (!match) {
    console.error(`❌ No s'ha trobat el hash per ${key} al Service Worker`);
    allHashesValid = false;
    errors.push(`Hash no trobat al SW: ${key}`);
    continue;
  }

  const swHash = match[1];

  // Comparar hashes
  if (swHash !== actualHash) {
    console.error(`❌ HASH INCORRECTE per ${key}`);
    console.error(`   Fitxer:         ${filePath}`);
    console.error(`   Hash al fitxer: ${actualHash}`);
    console.error(`   Hash al SW:     ${swHash}`);
    console.error(`   ⚠️  Executa 'npm run update-hashes' per actualitzar!\n`);
    allHashesValid = false;
    errors.push(`Hash incorrecte: ${key}`);
  } else {
    console.log(`✅ ${key}`);
    console.log(`   Hash: ${actualHash}\n`);
  }
}

if (!allHashesValid) {
  console.error("\n❌ ERROR: Hashes d'integritat NO vàlids!");
  console.error("   Problemes detectats:");
  errors.forEach((err) => console.error(`   - ${err}`));
  console.error("\n💡 Solució: Executa 'npm run update-hashes' per actualitzar els hashes.");
  process.exit(1);
}

console.log("🎉 Tots els hashes són correctes! El Service Worker està sincronitzat.\n");
