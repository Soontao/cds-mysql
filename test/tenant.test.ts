
import { doAfterAll } from "./utils";
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import MySQLDatabaseService from "../src";


describe("Tenant Test Suite", () => {

  const client = setupTest(__dirname, "./resources/integration");
  client.defaults.auth = { username: "alice", password: "admin" };

  const cds = cwdRequireCDS();
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

  it("should support subscribe tenant", async () => {
    await client.put("/-/cds/saas-provisioning/tenant/t192", {}, {
      auth: {
        username: "yves", password: ""
      }
    });
  });

  it("should support upgrade all tenant", async () => {
    await client.post(
      "/-/cds/saas-provisioning/upgrade",
      {
        "tenants": ["*"]
      },
      {
        auth: {
          username: "yves", password: ""
        }
      }
    );
  });

  it("should support get tenant tables", async () => {

    const db: MySQLDatabaseService = cds.db as any;
    const tool = db.getAdminTool();
    const tables = await tool.getTables("t192");
    expect(tables.length > 0).toBeTruthy();

  });

  it("should raise error when tenant-id too long", () => {

    const db: MySQLDatabaseService = cds.db as any;
    const tool = db.getAdminTool();
    expect(() => tool.getTenantDatabaseName(cds.utils.uuid() + cds.utils.uuid()))
      .toThrowError("TENANT_DATABASE_NAME_TOO_LONG");

  });

  it("should support unsubscribe tenant", async () => {
    await client.delete("/-/cds/saas-provisioning/tenant/t192", {
      auth: {
        username: "yves", password: ""
      }
    });
  });

});
