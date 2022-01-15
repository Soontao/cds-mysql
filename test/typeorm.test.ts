import { pick, range, sleep, trimSuffix } from "@newdash/newdash";
import map from "@newdash/newdash/map";
import { ConnectionOptions } from "typeorm";
import { csnToEntity, migrate } from "../src/typeorm";
import { EXPECTED_MIGRATE_DDL } from "./resources/migrate/expected.migrate";
import { cleanDB, getTestTypeORMOptions, loadCSN } from "./utils";

describe("TypeORM Test Suite", () => {
  
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
      range(1, 9)
        .map((idx) => `./resources/migrate/step-${idx}.cds`)
        .map(loadCSN)
    );

    const entityList = CSNs.map(csnToEntity);

    const baseOption: ConnectionOptions = {
      ...getTestTypeORMOptions(),
      name: "migrate-test-01",
      type: "mysql",
      logging: false
    };

    // do migration one by one

    for (let idx = 0; idx < entityList.length; idx++) {
      const migrationId = `${idx}->${idx + 1}`;
      const entities = entityList[idx];
      const ddl = (await migrate({ ...baseOption, entities: entities }, true)).upQueries.map((query) =>
        pick(query, "query", "parameters")
      );

      // replace with current UT database name
      const expected = EXPECTED_MIGRATE_DDL[migrationId];

      for (let idx = 0; idx < ddl.length; idx++) {
        const aDdl = ddl[idx];
        const aExpected = expected[idx];
        expect(trimSuffix(aDdl.query, ";")).toBe(trimSuffix(aExpected.query, ";"));
        expect(map(aDdl.parameters ?? [], (parameter) => trimSuffix(parameter, ";"))).toStrictEqual(
          map(aExpected.parameters ?? [], (parameter) => trimSuffix(parameter, ";"))
        );
      }

      await migrate({ ...baseOption, entities: entities });
    }
  });

  afterAll(async () => {
    await sleep(100);
    await cleanDB();
  });
});
