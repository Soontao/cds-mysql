module.exports = {
  "testTimeout": 30 * 3000, // 30s
  "transform": {
    ".(ts|tsx)": "ts-jest"
  },
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!**/node_modules/**"
  ],
  "coveragePathIgnorePatterns": [
    "node_modules/",
    "src/bin"
  ],
  "testEnvironment": "node",
  "testRegex": "/test/.*\\.test\\.ts$",
  "moduleFileExtensions": [
    "ts",
    "js",
    "json"
  ]
};