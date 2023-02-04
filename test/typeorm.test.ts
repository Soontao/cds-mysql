import { pick } from "@newdash/newdash";
import { cwdRequireCDS } from "cds-internal-tool";
import fs from "fs/promises";
import path from "path";
import { DataSourceOptions } from "typeorm";
import { csnToEntity, entitySchemaToTable, migrate } from "../src/typeorm";
import { sha256 } from "../src/typeorm/csv";
import { TypeORMLogger } from "../src/typeorm/logger";
import { equalWithoutCase } from "../src/typeorm/mysql/utils";
import { cleanDB, doAfterAll, getTestTypeORMOptions, loadCSN } from "./utils";

describe("TypeORM Test Suite", () => {

  require("dotenv").config();

  beforeAll(async () => { await cleanDB(); });

  afterAll(doAfterAll);

  it("should support convert simple entity to EntitySchema", async () => {
    const csn = await loadCSN("./resources/people.cds");
    const entities = csnToEntity(csn);
    expect(entities).toHaveLength(1);
  });

  it("should support convert complex type to EntitySchema", async () => {
    const csn = await loadCSN("./resources/complex-type.cds");
    const entities = csnToEntity(csn);
    expect(entities).toHaveLength(1);
  });

  it("should support convert csn to table meta", async () => {
    const csn = await loadCSN("./resources/complex-type.cds");
    expect(csnToEntity(csn).map(entitySchemaToTable)).toMatchSnapshot();
  });

  it("should support extensions for csv app", async () => {
    const csn = await cwdRequireCDS().load("*", {
      root: path.join(__dirname, "./resources/csv-app")
    });
    const entities = csnToEntity(csn);
    expect(entities).toMatchSnapshot();
  });

  it("should support compare with string without case sensitive", () => {
    expect(equalWithoutCase("a", "A")).toBeTruthy();
    expect(equalWithoutCase("123", "123")).toBeTruthy();
    expect(equalWithoutCase("a1", "a1")).toBeTruthy();
    expect(equalWithoutCase("", "")).toBeTruthy();
    expect(equalWithoutCase(undefined, undefined)).toBeTruthy();

    expect(equalWithoutCase(undefined, "")).toBeFalsy();
    expect(equalWithoutCase("", undefined)).toBeFalsy();
    expect(equalWithoutCase("1", undefined)).toBeFalsy();
    expect(equalWithoutCase("a1", "1a")).toBeFalsy();
  });

  it("should support convert different prop type to EntitySchema", async () => {
    const csn = await loadCSN("./resources/property-type.cds");
    const entities = csnToEntity(csn);
    expect(entities).toHaveLength(1);

    const [entity] = entities;
    const { columns } = entity.options;

    for (const columnName of Object.keys(columns)) {
      expect(columns[columnName]).toMatchSnapshot(`${entity.options.name}.${columnName} element definition`);
    }

  });

  it("should support convert cuid aspect", async () => {
    const csn = await loadCSN("./resources/fiori/srv/srv.cds");
    const entities = csnToEntity(csn);

    for (const entity of entities) {
      const { columns } = entity.options;
      for (const columnName of Object.keys(columns)) {
        expect(columns[columnName]).toMatchSnapshot(`${entity.options.name}.${columnName} element definition`);
      }
    }

  });


  it("should support migrate different prop type to mysql", async () => {
    const csn = await loadCSN("./resources/property-type.cds");
    const entities = csnToEntity(csn);
    const baseOption: DataSourceOptions = {
      ...getTestTypeORMOptions(),
      name: "migrate-test-for-reserved-things",
      type: "mysql",
      logging: false
    };
    const ddl = (await migrate({ ...baseOption, entities: entities }, true)).upQueries.map((query) =>
      pick(query, "query", "parameters")
    );

    expect(ddl).toMatchSnapshot();

  });

  it("should assert all migrate cds files generated entities", async () => {
    const files = await fs.readdir(path.join(__dirname, "./resources/migrate"));
    for (const file of files) {
      const csn = await loadCSN(path.join("./resources/migrate", file));
      expect(csnToEntity(csn)).toMatchSnapshot(`entities of file ${file}`);
    }
  });

  it("should support migrate tables", async () => {

    await cleanDB();

    const files = await fs.readdir(path.join(__dirname, "./resources/migrate"));

    const baseOption: DataSourceOptions = {
      ...getTestTypeORMOptions(),
      name: "migrate-test-01",
      type: "mysql",
      logging: false
    };

    // do migration one by one
    for (let idx = 1; idx <= files.length; idx++) {
      const migrationId = `${idx - 1}->${idx}`;
      const entities = csnToEntity(await loadCSN(`./resources/migrate/step-${idx}.cds`));
      // get DDL from dry run
      const ddl = (await migrate({ ...baseOption, entities: entities }, true)).upQueries.map((query) =>
        pick(query, "query", "parameters")
      );

      expect(ddl).toMatchSnapshot(migrationId);

      // perform really migration
      await migrate({ ...baseOption, entities: entities });

      // after migration, if the entity is not changed, do nothing
      const ddlAfterMigrate = (await migrate({ ...baseOption, entities: entities }, true)).upQueries.map((query) =>
        pick(query, "query", "parameters")
      );
      expect(ddlAfterMigrate).toHaveLength(0);
    }

  });

  it("should support sha256 hash", async () => {
    const hashOfBigSizeTableContent = await sha256(path.join(__dirname, "./resources/big-size-table.cds"));
    expect(hashOfBigSizeTableContent.length).toMatchSnapshot("hash length");
    expect(hashOfBigSizeTableContent).toMatchSnapshot("hash value");
  });

  it("should support logger for typeorm", () => {
    TypeORMLogger.logQueryError(new Error("any"), "select 1 from dummy");
    TypeORMLogger.logQuerySlow(9999, "select 1 from dummy");
    TypeORMLogger.logMigration("dummy message");
    TypeORMLogger.log("info", "dummy message");
  });

});
