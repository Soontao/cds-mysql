import { doAfterAll, doBeforeEach } from "./utils";
import { setupTest } from "cds-internal-tool";


describe("CSV App Test Suite", () => {

  const client = setupTest(__dirname, "./resources/csv-app");

  beforeEach(doBeforeEach);

  afterAll(doAfterAll);

  it("should support automatically migrate csv data", async () => {
    const response = await client.get("/app/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Peoples/);

    const p1r = await client.get("/app/Peoples(1)");
    expect(p1r.status).toBe(200);
    expect(p1r.data.Name).toBe("Theo 1");
  });


});
