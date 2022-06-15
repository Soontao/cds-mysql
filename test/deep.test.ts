import { setupTest } from "cds-internal-tool";
import { doAfterAll } from "./utils";

describe("Deep Operation Test Suite", () => {

  const client = setupTest(__dirname, "./resources/deep");
  client.defaults.auth = { username: "alice", password: "admin" };

  afterAll(doAfterAll);

  it("should support get metadata", async () => {
    const response = await client.get("/deep/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Person/);
  });

  it("should support deep composition creation", async () => {
    const response = await client.post("/deep/Person", {
      ID: 1,
      Name: "Person 1",
      addresses: [
        {
          ID: 1,
          Country: "CN",
          City: "Chengdu",
        },
        {
          ID: 2,
          Country: "CN",
          City: "Shanghai",
        },
        {
          ID: 3,
          Country: "CN",
          City: "Shanghai",
        },
      ]
    });
    expect(response.status).toBe(201);
    expect(response.data).toMatchSnapshot();
  });


});