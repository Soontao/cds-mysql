// @ts-nocheck

import { doAfterAll } from "./utils";
import { setupTest } from "cds-internal-tool";

describe("Tenant Test Suite", () => {

  const client = setupTest(__dirname, "./resources/integration");
  client.defaults.auth = { username: "alice", password: "admin" };


  afterAll(doAfterAll);

  it("should support multi-tenancy", async () => {
    let response = await client.post("/bank/Peoples", { Name: "Theo in Defualt Tenant" });
    expect(response.status).toBe(201);
    response = await client.get("/bank/Peoples/$count");
    expect(response.data).toBe(1);
    response = await client.get("/bank/Peoples", {
      auth: {
        username: "theo-on-tenant-2",
        password: "any"
      }
    });
    expect(response.data.value.length).toBe(0);
  });


});
