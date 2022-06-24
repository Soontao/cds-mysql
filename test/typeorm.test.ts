import { pick, range } from "@newdash/newdash";
import path from "path";
import { DataSourceOptions } from "typeorm";
import { csnToEntity, migrate } from "../src/typeorm";
import { sha256 } from "../src/typeorm/csv";
import { equalWithoutCase } from "../src/typeorm/mysql/utils";
import { doAfterAll, getTestTypeORMOptions, loadCSN } from "./utils";

describe("TypeORM Test Suite", () => {

  require("dotenv").config();

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

    expect(columns["Type"].primary).toBeTruthy();
    expect(columns["Name"].primary).toBeTruthy();
    expect(columns["BirthDay"].nullable).toBeFalsy();
    expect(columns["FullEmployee"].default).toStrictEqual(false);
    expect(columns["Active"].default).toStrictEqual(true);
  });

  it("should support migrate tables", async () => {
    const CSNs = await Promise.all(
      range(1, 10)
        .map((idx) => `./resources/migrate/step-${idx}.cds`)
        .map(loadCSN)
    );

    const entityList = CSNs.map(csnToEntity);

    expect(entityList).toMatchSnapshot();

    const baseOption: DataSourceOptions = {
      ...getTestTypeORMOptions(),
      name: "migrate-test-01",
      type: "mysql",
      logging: false
    };

    // do migration one by one

    for (let idx = 0; idx < entityList.length; idx++) {
      const migrationId = `${idx}->${idx + 1}`;
      const entities = entityList[idx];
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

});
