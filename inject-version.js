#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Read package.json to get the version
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = packageJson.version;

console.log(`Injecting version ${version} into files...`);

// Update index.html - replace version in span.version-text
const indexPath = "index.html";
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, "utf8");

  // Replace version in span with class "version-text"
  indexContent = indexContent.replace(
    /<span[^>]*class="[^"]*version-text[^"]*"[^>]*>([^<]*)<\/span>/,
    `<span class="version-text">${version}</span>`
  );

  fs.writeFileSync(indexPath, indexContent);
  console.log(`✅ Updated version in ${indexPath}`);
} else {
  console.warn(`⚠️  ${indexPath} not found`);
}

// Update service-worker.js - replace VERSION constant
const swPath = "service-worker.js";
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, "utf8");

  // Replace VERSION constant (avoiding CDN URLs)
  swContent = swContent.replace(
    /const VERSION = ["'][^"']*["']/,
    `const VERSION = "${version}"`
  );

  fs.writeFileSync(swPath, swContent);
  console.log(`✅ Updated VERSION in ${swPath}`);
} else {
  console.warn(`⚠️  ${swPath} not found`);
}

console.log(`🎉 Version injection completed!`);
