// @ts-nocheck
import { sleep } from "@newdash/newdash/sleep";
import cds from "@sap/cds";
import cds_deploy from "@sap/cds/lib/deploy";
import { cleanDB, createRandomName, loadCSN, setupEnv } from "./utils";

describe("CDS MySQL Basic Test Suite", () => {

  setupEnv();

  it("should support deploy simple entity (with e2e CRUD)", async () => {

    const csn = await loadCSN("./resources/people.cds");
    await cds_deploy(csn).to("mysql");
    const randomName = createRandomName();
    const randomName2 = createRandomName();
    // create item
    await cds.run(INSERT.into("People").entries({ Name: randomName }));
    const items = await cds.run(SELECT.from("People").where({ Name: randomName }));
    expect(items).toHaveLength(1);
    expect(items[0].Name).toBe(randomName);

    // update name
    await cds.run(UPDATE.entity("People", items[0].ID).with({ Name: randomName2 }));
    const item = await cds.run(SELECT.one.from("People", items[0].ID));
    expect(item).not.toBeNull();
    expect(item.Name).toBe(randomName2);

    // delete item
    await cds.run(DELETE.from("People", item.ID));
    const item2 = await cds.run(SELECT.one.from("People", item.ID));
    expect(item2).toBeNull();

    // insert multi
    const result = await cds.run(INSERT.into("People").entries(
      { Name: createRandomName() },
      { Name: createRandomName() },
    ));
    expect(result).not.toBeNull();

    const [{ total }] = await cds.run(SELECT.from("People").columns("count(1) as total"));
    expect(total).toBe(2);

  });

  it("should support deploy complex-type entity", async () => {
    const csn = await loadCSN("./resources/complex-type.cds");
    await cds_deploy(csn).to("mysql");
  });

  it("should support deploy different property types entity", async () => {
    const csn = await loadCSN("./resources/property-type.cds");
    await cds_deploy(csn).to("mysql");
  });

  it("should support deploy long name entity", async () => {
    const csn = await loadCSN("./resources/long-table-name.cds");
    await cds_deploy(csn).to("mysql");
  });

  it("should support deploy view", async () => {
    const csn = await loadCSN("./resources/view.cds");
    await cds_deploy(csn).to("mysql");
  });

  it("should support deploy large row size table", async () => {
    const csn = await loadCSN("./resources/big-size-table.cds");
    await cds_deploy(csn).to("mysql");
  });

  afterAll(async () => {
    // wait all table deployment
    await sleep(500);
    await cleanDB();
  });

});