import { doAfterAll } from "./utils";
import { setupTest } from "cds-internal-tool";


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

  it("should match the second record by cds API", async () => {
    const values = await cds.run(SELECT.one.from("test.resources.csv.app.srv.AppService.TypeEntity", 2));
    expect(values).toMatchSnapshot();
  });


});
