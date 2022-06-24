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

  it("should support deep update scenario", async () => {
    let response = await client.put("/deep/Person(1)", {
      ID: 1,
      Name: "Person 1 Updated by PUT",
      addresses: [
        {
          ID: 1,
        },
        {
          ID: 3,
          Country: "CN",
          City: "Shanghai Updated",
        },
      ]
    });
    expect(response.status).toBe(200);

    const { data } = await client.get("/deep/Person(1)?$expand=addresses");
    expect(data).toMatchSnapshot("put update");

    response = await client.patch("/deep/Person(1)", {
      ID: 1,
      Name: "Person 1 Updated by PATCH",
      addresses: [
        {
          ID: 1,
          Country: "CN",
          City: "Chengdu",
        },
        {
          ID: 3,
          Country: "CN",
        },
      ]
    });


    const r2 = await client.get("/deep/Person(1)?$expand=addresses");
    expect(r2.data).toMatchSnapshot("patch update");

  });

  // TODO: check why this fails for old mysql
  it.skip("should support deletion", async () => {
    const response = await client.delete("/deep/Person(1)");
    expect(response.data?.error?.message).toBeUndefined();
    expect(response.status).toBe(204);
  });


});