
import { doAfterAll } from "./utils";
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import type MySQLDatabaseService from "../src";

const NEW_TENANT_ID = "t192";

describe("Tenant Test Suite", () => {

  const client = setupTest(__dirname, "./resources/integration");
  client.defaults.auth = { username: "yves", password: "" };

  const cds = cwdRequireCDS();
  afterAll(doAfterAll);

  it("should support multi-tenancy", async () => {
    let response = await client.post(
      "/bank/Peoples",
      { Name: "Theo in Defualt Tenant" },
      {
        auth: { username: "alice", password: "admin" }
      }
    );
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
        tenant: NEW_TENANT_ID,
        metadata: {}
      }
    );
    expect(status).toMatchInlineSnapshot(`204`);

  });

  it("should support get tables/columns", async () => {
    const db: MySQLDatabaseService = cds.db as any;
    const tool = db.getAdminTool();
    const tables = await tool.getTables();
    expect(tables.length).toBeGreaterThan(0);
    const columns = await tool.getColumns(tables[0]);
    expect(columns.length).toBeGreaterThan(0);
  });

  it("should support upgrade all tenant", async () => {
    const { status } = await client.post(
      "/-/cds/deployment/upgrade",
      {
        "tenant": NEW_TENANT_ID
      }
    );
    expect(status).toMatchInlineSnapshot(`204`);
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
        tenant: NEW_TENANT_ID,
        metadata: {}
      }
    );
    expect(status).toMatchInlineSnapshot(`204`);

  });

});
