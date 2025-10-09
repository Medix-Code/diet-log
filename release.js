// release.js - Automatic version release workflow
const { execSync } = require("child_process");
const fs = require("fs");

try {
  console.log("🚀 Starting release process...");

  // Step 1: Run inject-version to sync versions
  console.log("📦 Injecting version into files...");
  execSync("npm run inject-version", { stdio: "inherit" });

  // Step 2: Read new version from package.json
  const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
  const newVersion = packageJson.version;

  if (!newVersion) {
    throw new Error("No version found in package.json after inject-version");
  }

  console.log(`📝 New version: ${newVersion}`);

  // Step 3: Add files to git
  console.log("📋 Staging files...");
  execSync("git add package.json index.html service-worker.js", {
    stdio: "inherit",
  });

  // Step 4: Commit with version message
  const commitMessage = `"Version bump to ${newVersion}"`;
  console.log(`💾 Committing: ${commitMessage}`);
  execSync(`git commit -m ${commitMessage}`, { stdio: "inherit" });

  // Step 5: Push to remote
  console.log("🚀 Pushing to origin main...");
  execSync("git push origin main", { stdio: "inherit" });

  console.log(`✅ Release ${newVersion} completed successfully!`);
} catch (error) {
  console.error("❌ Release failed:", error.message);
  process.exit(1);
}
