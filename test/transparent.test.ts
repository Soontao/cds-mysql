/* eslint-disable max-len */
import { setupTest } from "cds-internal-tool";
import { doAfterAll } from "./utils";

describe("transparent Test Suite", () => {

  const client = setupTest(__dirname, "./resources/transparent");
  client.defaults.auth = { username: "alice", password: "admin" };

  afterAll(doAfterAll);

  it("should support get metadata", async () => {
    const response = await client.get("/fiori/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Persons/);
  });

});