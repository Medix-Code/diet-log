module.exports = {
  preset: "jest-puppeteer",
  testMatch: ["tests/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
};
