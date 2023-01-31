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
    "!test/resources/**",
    "!**/node_modules/**"
  ],
  coveragePathIgnorePatterns: [
    "node_modules/",
    "src/typeorm/mysql",
    "src/scripts", // REVISIT: add unit test later
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