module.exports = {
  "testTimeout": 30 * 1000,
  "transform": {
    ".(ts|tsx)": "ts-jest"
  },
  "collectCoverageFrom": [
    "src/**/*.ts",
    "!**/node_modules/**"
  ],
  "coveragePathIgnorePatterns": [
    "node_modules/",
    "src/typeorm/mysql"
  ],
  "testEnvironment": "node",
  "testRegex": "/test/.*\\.test\\.ts$",
  "moduleFileExtensions": [
    "ts",
    "js",
    "json"
  ]
};