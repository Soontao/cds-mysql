/* eslint-disable max-len */
// @ts-nocheck
import { checkCdsVersion, migration } from "../src/utils";
import { VERSION } from "../src/cds.version";

const mockCds = { version: VERSION.substring(1) };
jest.mock("cds-internal-tool", () => ({
  ...jest.requireActual("cds-internal-tool"),
  cwdRequireCDS: () => mockCds,
}));

describe("Utils Test Suite", () => {

  it("should do nothing if version is correct", () => {
    checkCdsVersion();
  });

  it("should raise error when version is not match", () => {
    mockCds.version = "5.9.8";
    expect(() => checkCdsVersion()).toThrowError();
  });

  it("should support generate/parse migration script", () => {
    const script = migration.stringify(
      [
        {
          version: 100,
          statements: [
            {
              "query": "CREATE TABLE `sap_common_Currencies_texts` (`locale` varchar(14) NOT NULL, `name` varchar(255) NULL, `descr` varchar(1000) NULL, `code` varchar(3) NOT NULL, PRIMARY KEY (`locale`, `code`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'"
            },
            {
              "query": "CREATE TABLE `test_int_Product_texts` (`locale` varchar(14) NOT NULL, `ID` varchar(36) NOT NULL, `Name` varchar(255) NULL, PRIMARY KEY (`locale`, `ID`)) ENGINE=InnoDB CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'"
            },
          ]
        },
        {
          version: 102,
          statements: [
            {
              "query": "DROP VIEW `test_int_BankService_Peoples`"
            },
            {
              "query": "ALTER TABLE `test_int_People` ADD `Name3` varchar(30) NULL DEFAULT 'dummy'"
            },
            {
              "query": "CREATE VIEW `test_int_BankService_Peoples` AS SELECT\n  People_0.ID,\n  People_0.createdAt,\n  People_0.createdBy,\n  People_0.modifiedAt,\n  People_0.modifiedBy,\n  People_0.Name,\n  People_0.Name2,\n  People_0.Name3,\n  People_0.Age,\n  People_0.RegisterDate,\n  People_0.Detail_ID\nFROM test_int_People AS People_0;"
            }
          ]
        }
      ]
    );
    expect(script).toMatchSnapshot();
    expect(migration.parse(script)).toMatchSnapshot("parsed object");
    expect(migration.stringify(migration.parse(script))).toBe(script);
  });

});