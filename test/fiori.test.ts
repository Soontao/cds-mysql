import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import { doAfterAll } from "./utils";



describe("fiori draft Test Suite", () => {

  cwdRequireCDS();
  const client = setupTest(__dirname, "./resources/fiori");
  client.defaults.auth = { username: "alice", password: "admin" };

  afterAll(doAfterAll);

  it("should support get metadata", async () => {
    const response = await client.get("/fiori/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Persons/);
  });

});