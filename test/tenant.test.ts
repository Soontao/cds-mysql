// @ts-nocheck

import { doAfterAll } from "./utils";
import { cwdRequireCDS, setupTest } from "cds-internal-tool";

import { ShareMysqlTenantProvider } from "../src/tenant";

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

  it("should support get database name", () => {
    const s = new ShareMysqlTenantProvider(cwdRequireCDS().db)
    expect(s['getTenantDatabaseName']()).toMatchInlineSnapshot(`"cds_admin"`)
    expect(s['getTenantDatabaseName']("wwww-wwww-www")).toMatchInlineSnapshot(`"tenant_db_wwww_wwww_www"`)
    expect(s['getTenantDatabaseName']("3413242312432^&*(")).toMatchInlineSnapshot(`"tenant_db_3413242312432_"`)
    expect(s['getTenantDatabaseName']("+++wwww-wwww----www")).toMatchInlineSnapshot(`"tenant_db__wwww_wwww_www"`)

  })


});
