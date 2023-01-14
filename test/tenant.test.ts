
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
    const { status } = await client.post(
      "/-/cds/deployment/subscribe",
      {
        tenant: "t192",
        metadata: {}
      },
      {
        auth: {
          username: "yves", password: ""
        }
      }
    );
    expect(status).toMatchInlineSnapshot(`204`);
  });

  it("should support upgrade all tenant", async () => {
    const { status } = await client.post(
      "/-/cds/deployment/upgrade",
      {
        "tenant": "t192"
      },
      {
        auth: {
          username: "yves", password: ""
        }
      }
    );
    expect(status).toMatchInlineSnapshot(`204`);
  });

  it("should support get tenant tables/columns", async () => {
    const db: MySQLDatabaseService = cds.db as any;
    const tool = db.getAdminTool();
    const tables = await tool.getTables("t192");
    expect(tables.length).toBeGreaterThan(0);
    const columns = await tool.getColumns(tables[0], "t192");
    expect(columns.length).toBeGreaterThan(0);
  });

  it("should raise error when tenant-id too long", () => {

    const db: MySQLDatabaseService = cds.db as any;
    const tool = db.getAdminTool();
    expect(() => tool.getTenantDatabaseName(cds.utils.uuid() + cds.utils.uuid()))
      .toThrowError("TENANT_DATABASE_NAME_TOO_LONG");

  });

  it("should support unsubscribe tenant", async () => {
    const { status } = await client.post(
      "/-/cds/deployment/unsubscribe",
      {
        tenant: "t192",
        metadata: {}
      },
      {
        auth: {
          username: "yves", password: ""
        }
      }
    );
    expect(status).toMatchInlineSnapshot(`204`);

  });

});
