import { doAfterAll } from "./utils";
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import path from "path";


describe("CSV App Test Suite", () => {

  const client = setupTest(__dirname, "./resources/csv-app");

  afterAll(doAfterAll);

  it("should support automatically migrate csv data", async () => {
    const response = await client.get("/app/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Peoples/);
    const p1r = await client.get("/app/Peoples(1)");
    expect(p1r.status).toBe(200);
    expect(p1r.data.Name).toBe("Theo 1");
    const { data } = await client.get("/app/Peoples");
    expect(data).toMatchSnapshot();
  });

  it("should match the first record by axios client", async () => {
    const t1r = await client.get("/app/TypeEntity(1)");
    expect(t1r.data).toMatchSnapshot();
  });

  it("should match the first record by cds API", async () => {
    const values = await cds.run(SELECT.one.from("test.resources.csv.app.srv.AppService.TypeEntity", 1));
    expect(values).toMatchSnapshot();
  });

  it("should match the second record by axios client", async () => {
    const { data } = await client.get("/app/TypeEntity(2)");
    expect(data).toMatchSnapshot();
  });

  it("should support ISO format date string", async () => {
    const { data } = await client.get("/app/TypeEntity(3)");
    expect(data).toMatchSnapshot();
  });


  it("should match the second record by cds API", async () => {
    const values = await cds.run(SELECT.one.from("test.resources.csv.app.srv.AppService.TypeEntity", 2));
    expect(values).toMatchSnapshot();
  });

  it("should support search", async () => {
    const res1 = await client.get("/app/Houses?$search=Chengdu");
    expect(res1.status).toBe(200);
    expect(res1.data).toMatchSnapshot();

    const res2 = await client.get("/app/Houses?$search=2357853");
    expect(res2.data).toMatchSnapshot();

  });

  it("should support filter by datetime", async () => {
    const res = await client.get("/app/TypeEntity?$filter=Sign eq 2022-06-13T12:35:10Z");
    expect(res.status).toBe(200);
    expect(res.data?.value?.[0]?.ID).toBe(3);
  });

  it("should support filter by datetimeoffset", async () => {
    const res = await client.get("/app/TypeEntity?$filter=SignTmp eq 2022-06-12T12:35:10.000Z");
    expect(res.status).toBe(200);
    expect(res.data?.value?.[0]?.ID).toBe(3);
  });

  it("should support filter by datetimeoffset with timezone", async () => {
    const res = await client.get("/app/TypeEntity?$filter=SignTmp eq 2022-06-12T20:35:10.000+08:00");
    expect(res.status).toBe(200);
    expect(res.data?.value?.[0]?.ID).toBe(3);
  });


  it("should support migrate again", async () => {
    cwdRequireCDS().db?.["deploy"]?.(
      await cwdRequireCDS().load("*", { root: path.join(__dirname, "./resources/csv-app") })
    );
  });

  for (const aggrMethod of ["sum", "min", "max", "average", "countdistinct"]) {
    it(`should support simple ${aggrMethod} aggregation`, async () => {
      const res1 = await client.get(`/app/Houses?$apply=aggregate(price with ${aggrMethod} as ${aggrMethod}_price)`);
      expect(res1.status).toBe(200);
      expect(res1.data).toMatchSnapshot();
    });

  }

});
