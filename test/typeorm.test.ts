import { range, sleep } from "@newdash/newdash";
import { ConnectionOptions } from "typeorm";
import { csnToEntity, migrate } from "../src/typeorm";
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
    expect(columns["FullEmployee"].default).toStrictEqual(true);

  });

  it("should support migrate tables", async () => {


    const CSNs = await Promise.all(
      range(1, 8)
        .map(idx => `./resources/migrate/step-${idx}.cds`)
        .map(loadCSN)
    );

    const entityList = CSNs.map(csnToEntity);

    const baseOption: ConnectionOptions = {
      ...getTestTypeORMOptions(),
      name: "migrate-test-01",
      type: "mysql",
      // logging: true,
    };

    // do migration one by one
    for (const entities of entityList) {
      await migrate({ ...baseOption, entities: entities });
    }

  });

  afterAll(async () => {
    await sleep(100);
    await cleanDB();
  });


});