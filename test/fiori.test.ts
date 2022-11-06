import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import { doAfterAll } from "./utils";



describe("fiori draft Test Suite", () => {

  const cds = cwdRequireCDS();
  const client = setupTest(__dirname, "./resources/fiori");
  client.defaults.auth = { username: "alice", password: "admin" };


  beforeAll(() => { jest.spyOn(cds.db, "run"); });

  afterAll(doAfterAll);


  it("should support get metadata", async () => {
    const response = await client.get("/fiori/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Persons/);
  });

  const ID = "95f96069-e831-4e30-9567-37a1490b9385";

  it("should support to create instance", async () => {
    const response = await client.post("/fiori/Persons", {
      ID,
      Name: "Theo Sun",
      Age: 26,
    });
    expect(response.data?.error).toBeUndefined();
    expect(response.status).toBe(201);
    expect(response.data).toMatchSnapshot();
  });

});