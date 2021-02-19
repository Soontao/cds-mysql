
import { sleep } from "@newdash/newdash";
import { ConnectionOptions } from "typeorm";
import { csnToEntity, migrate } from "../src/typeorm";
import { loadCSN } from "./utils";

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
    const entities_step_1 = csnToEntity(await loadCSN("./resources/migrate/step-1.cds"));
    const entities_step_2 = csnToEntity(await loadCSN("./resources/migrate/step-2.cds"));
    const entities_step_3 = csnToEntity(await loadCSN("./resources/migrate/step-3.cds"));
    expect(entities_step_3).toHaveLength(2);
    const entities_step_4 = csnToEntity(await loadCSN("./resources/migrate/step-4.cds"));
    expect(entities_step_4).toHaveLength(4);

    const baseOption: ConnectionOptions = {
      name: "migrate-test-01",
      type: "mysql",
      username: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT),
      // logging: true,
    };

    await migrate({ ...baseOption, entities: entities_step_1 });
    await migrate({ ...baseOption, entities: entities_step_2 });
    await migrate({ ...baseOption, entities: entities_step_3 });
    // step 4 will include the cross ref view
    // so the view creation order will be important
    await migrate({ ...baseOption, entities: entities_step_4 });


  });

  afterAll(async () => {
    await sleep(100);
  });


});