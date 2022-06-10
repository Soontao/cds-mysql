// @ts-nocheck

import path from "path";
import { doAfterAll, doBeforeEach } from "./utils";
import { cwdRequireCDS, setupTest } from "cds-internal-tool";


describe("CSV Test Suite", () => {

  const cds = cwdRequireCDS();
  const client = setupTest(__dirname, "./resources/integration");
  client.defaults.auth = { username: "alice", password: "admin" };

  const ENTITIES = { PEOPLE: "People" };

  beforeEach(doBeforeEach);

  afterAll(doAfterAll);

  it("should support migrate csv data", async () => {

    const { migrateData } = require("../src/typeorm");
    const migrateTo = async (version: string) => migrateData(
      cds.db,
      cds.model,
      [path.join(__dirname, `./resources/integration/db/data/${version}/test_resources_integration_People.csv`)],
    );
    await migrateTo("v1");
    const people5 = await cds.run(
      SELECT
        .one
        .from(ENTITIES.PEOPLE)
        .where({ Name: "People5" })
    );
    expect(people5).not.toBeNull();
    expect((people5.ID)).toBe("e3cf83a0-2d99-11ec-8d3d-0242ac130003");

    await migrateTo("v2");
    const people1000005 = await cds.run(
      SELECT
        .one
        .from(ENTITIES.PEOPLE)
        .byKey("e3cf83a0-2d99-11ec-8d3d-0242ac130003")
    );
    expect(people1000005).not.toBeNull();
    expect(people1000005.Name).toBe("People1000005");
    expect(people1000005.Age).toBe(18);

    await migrateTo("v3");
    const peopleWithAge9999 = await cds.run(
      SELECT
        .one
        .from(ENTITIES.PEOPLE)
        .byKey("e3cf7edc-2d99-11ec-8d3d-0242ac130003")
    );
    expect(peopleWithAge9999).not.toBeNull();
    expect(peopleWithAge9999.Name).toBe("PeopleWithAge9999");
    expect(peopleWithAge9999.Age).toBe(9999);

    // original also existed
    expect(await cds.run(
      SELECT
        .one
        .from(ENTITIES.PEOPLE)
        .byKey("e3cf83a0-2d99-11ec-8d3d-0242ac130003")
    )).toMatchObject({
      Name: "People1000005",
      Age: 18,
    });

  });


});
