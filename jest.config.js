/**
 * @type {import("jest").Config}
 */
module.exports = {
  testTimeout: 60 * 1000,
  transform: {
    ".(ts|tsx)": "ts-jest"
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!**/node_modules/**"
  ],
  coveragePathIgnorePatterns: [
    "node_modules/",
    "src/typeorm/mysql",
    "src/mtxs",
  ],
  testEnvironment: "node",
  testRegex: "/test/.*\\.test\\.ts$",
  moduleFileExtensions: [
    "ts",
    "js",
    "json"
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      lines: 90,
      statements: 85,
      functions: 90,
    }
  }
};