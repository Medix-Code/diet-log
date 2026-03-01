#!/usr/bin/env node

const fs = require("fs");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = packageJson.version;
const assetVersion = version;

console.log(`Injecting version ${version} into files...`);

function updateVersionedAssetReferences(content) {
  return content
    .replace(
      /href="\/css\/main\.min\.css\?v=[^"]+"/g,
      `href="/css/main.min.css?v=${assetVersion}"`
    )
    .replace(
      /src="\.\/dist\/bundle\.js\?v=[^"]+"/g,
      `src="./dist/bundle.js?v=${assetVersion}"`
    )
    .replace(
      /(["'])\/dist\/bundle\.js\?v=[^"']+(["'])/g,
      `$1/dist/bundle.js?v=${assetVersion}$2`
    )
    .replace(
      /(["'])\/css\/main\.min\.css\?v=[^"']+(["'])/g,
      `$1/css/main.min.css?v=${assetVersion}$2`
    );
}

const indexPath = "index.html";
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, "utf8");

  indexContent = indexContent.replace(
    /<span[^>]*class="[^"]*version-text[^"]*"[^>]*>([^<]*)<\/span>/,
    `<span class="version-text" hidden>${version}</span>`
  );

  indexContent = updateVersionedAssetReferences(indexContent);

  fs.writeFileSync(indexPath, indexContent);
  console.log(`✅ Updated version in ${indexPath}`);
} else {
  console.warn(`⚠️  ${indexPath} not found`);
}

const swPath = "service-worker.js";
if (fs.existsSync(swPath)) {
  let swContent = fs.readFileSync(swPath, "utf8");

  swContent = swContent.replace(
    /const VERSION = ["'][^"']*["']/,
    `const VERSION = "${version}"`
  );
  swContent = updateVersionedAssetReferences(swContent);

  fs.writeFileSync(swPath, swContent);
  console.log(`✅ Updated VERSION in ${swPath}`);
} else {
  console.warn(`⚠️  ${swPath} not found`);
}

for (const filePath of ["update-hashes.js", "verify-hashes.js"]) {
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  ${filePath} not found`);
    continue;
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const updatedContent = updateVersionedAssetReferences(fileContent);
  fs.writeFileSync(filePath, updatedContent);
  console.log(`✅ Updated asset versions in ${filePath}`);
}

console.log("🎉 Version injection completed!");
