import { createRandomName, doAfterAll } from "./utils";
import { cwdRequireCDS, setupTest } from "cds-internal-tool";

describe("Upsert Test Suite", () => {

  const cds = cwdRequireCDS();
  const client = setupTest(__dirname, "./resources/upsert");
  client.defaults.auth = { username: "alice", password: "admin" };

  afterAll(doAfterAll);

  it("should support basic query", async () => {
    const response = await client.get("/odata/v4/demo/Products");
    expect(response.data.value.length).toBe(0);
  });

  it("should support upsert", async () => {
    const ID = cds.utils.uuid();
    const Name = createRandomName();
    const Name2 = createRandomName();
    const response1 = await client.post("/odata/v4/demo/Upsert", {
      ID, Name
    });
    expect(response1.status).toBe(200);
    const response2 = await client.post("/odata/v4/demo/Upsert", {
      ID, Name: Name2
    });
    expect(response2.status).toBe(200);
    expect(response2.data.Name).toBe(Name2);
  });

});
