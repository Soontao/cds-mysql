/* eslint-disable max-len */
import { doAfterAll } from "./utils";
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import path from "path";
import MySQLDatabaseService from "../src";


describe(`CSV App Test Suite - Feature (big js enabled)`, () => {

  const client = setupTest(__dirname, "./resources/csv-app");

  const cds = cwdRequireCDS();
  cds.env.features.bigjs = true;

  const { SELECT } = cds.ql;

  afterAll(doAfterAll);

  it("should support deploy by API", async () => {
    const db: MySQLDatabaseService = cwdRequireCDS().db as any;
    await db.getAdminTool().deployCSV();
  });

  it("should get error when create duplicated record", async () => {
    const { status, data } = await client.post("/odata/v4/app/Peoples", {
      ID: 1, Name: "1"
    });
    expect({ status }).toMatchSnapshot();
    expect(data.error.message).toMatch(/Duplicate/);
  });

  it("should support automatically migrate csv data", async () => {
    const response = await client.get("/odata/v4/app/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Peoples/);
    const p1r = await client.get("/odata/v4/app/Peoples(1)");
    expect(p1r.status).toBe(200);
    expect(p1r.data.Name).toBe("Theo 1");
    const { data } = await client.get("/odata/v4/app/Peoples");
    expect(data).toMatchSnapshot();

  });

  it("should be empty when default value input", async () => {
    const { data, status } = await client.get("/odata/v4/app/Areas");
    expect(status).toBe(200);
    expect(data.value).toHaveLength(0);
  });

  it("should match the first record by axios client", async () => {
    const t1r = await client.get("/odata/v4/app/TypeEntity(1)");
    expect(t1r.data).toMatchSnapshot();
  });

  it("should match the first record by cds API", async () => {
    const values = await cds.run(SELECT.one.from("test.resources.csv.app.srv.AppService.TypeEntity", 1));
    expect(values).toMatchSnapshot();
  });

  it("should match the second record by axios client", async () => {
    const { data } = await client.get("/odata/v4/app/TypeEntity(2)");
    expect(data).toMatchSnapshot();
  });

  it("should support ISO format date string", async () => {
    const { data } = await client.get("/odata/v4/app/TypeEntity(3)");
    expect(data).toMatchSnapshot();
  });


  it("should match the second record by cds API", async () => {
    const values = await cds.run(SELECT.one.from("test.resources.csv.app.srv.AppService.TypeEntity", 2));
    expect(values).toMatchSnapshot();
  });

  it("should support search", async () => {
    const res1 = await client.get("/odata/v4/app/Houses?$search=Chengdu");
    expect(res1.status).toBe(200);
    expect(res1.data).toMatchSnapshot();

    const res2 = await client.get("/odata/v4/app/Houses?$search=2357853");
    expect(res2.data).toMatchSnapshot();

  });

  it("should support filter by datetime", async () => {
    const res = await client.get("/odata/v4/app/TypeEntity?$filter=Sign eq 2022-06-13T12:35:10Z");
    expect(res.status).toBe(200);
    expect(res.data?.value?.[0]?.ID).toBe(3);
  });

  it("should support filter by datetimeoffset", async () => {
    const res = await client.get("/odata/v4/app/TypeEntity?$filter=SignTmp eq 2022-06-12T12:35:10.000Z");
    expect(res.status).toBe(200);
    expect(res.data?.value?.[0]?.ID).toBe(3);
  });

  it("should support filter by datetimeoffset with timezone", async () => {
    const res = await client.get("/odata/v4/app/TypeEntity?$filter=SignTmp eq 2022-06-12T20:35:10.000+08:00");
    expect(res.status).toBe(200);
    expect(res.data?.value?.[0]?.ID).toBe(3);
  });


  it("should support migrate again", async () => {
    await cwdRequireCDS().db?.["deploy"]?.(
      await cwdRequireCDS().load("*", { root: path.join(__dirname, "./resources/csv-app") })
    );
  });

  for (const aggregation of ["sum", "min", "max", "average", "countdistinct"]) {
    it(`should support simple ${aggregation} aggregation`, async () => {
      const res1 = await client.get(`/odata/v4/app/Houses?$apply=aggregate(price with ${aggregation} as ${aggregation}_price)`);
      expect(res1.status).toBe(200);
      expect(res1.data).toMatchSnapshot();
    });

  }

  it("should support migrate to v2 data", async () => {
    const db: MySQLDatabaseService = cwdRequireCDS().db as any;
    await db.getAdminTool().deployCSV(
      undefined,
      [
        "./resources/csv-app/db/__data_v2__/test_resources_csv_app_db-Area.csv",
        "./resources/csv-app/db/__data_v2__/test_resources_csv_app_db-House.csv",
      ].map(p => path.join(__dirname, p))
    );
  });

  it("should not be empty when migrated to v2", async () => {
    const { data, status } = await client.get("/odata/v4/app/Areas");
    expect(status).toBe(200);
    expect(data.value).toMatchSnapshot();
  });

  it("should update house after migrated to v2", async () => {
    const { data, status } = await client.get("/odata/v4/app/Houses(97dc9bc4-f61e-11ec-b939-0242ac120002)");
    expect({ data, status }).toMatchSnapshot();
  });

  it("should support delete pre-deliver data", async () => {
    const { data, status } = await client.delete(`/odata/v4/app/Houses(97dc9da4-f61e-11ec-b939-0242ac120002)`);
    expect({ data, status }).toMatchSnapshot();
  });

});
