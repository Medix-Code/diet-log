#!/usr/bin/env node

const fs = require("fs");

const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const version = packageJson.version;
const cssVersion = "2.3.6";

console.log(`Injecting version ${version} into files...`);

const indexPath = "index.html";
if (fs.existsSync(indexPath)) {
  let indexContent = fs.readFileSync(indexPath, "utf8");

  indexContent = indexContent.replace(
    /<span[^>]*class="[^"]*version-text[^"]*"[^>]*>([^<]*)<\/span>/,
    `<span class="version-text" hidden>${version}</span>`
  );

  indexContent = indexContent.replace(
    /href="\/css\/main\.min\.css\?v=[^"]+"/g,
    `href="/css/main.min.css?v=${cssVersion}"`
  );
  indexContent = indexContent.replace(
    /href="\/dist\/bundle\.js\?v=[^"]+"/g,
    `href="/dist/bundle.js?v=2.5.4"`
  );

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

  fs.writeFileSync(swPath, swContent);
  console.log(`✅ Updated VERSION in ${swPath}`);
} else {
  console.warn(`⚠️  ${swPath} not found`);
}

console.log("🎉 Version injection completed!");
