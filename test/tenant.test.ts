
import { createSh, doAfterAll } from "./utils";
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import path from "node:path";
import { sleep } from "@newdash/newdash";

jest.setTimeout(60 * 1000); // 1 minutes

const NEW_TENANT_ID = "t192";

describe("Tenant Test Suite", () => {

  const client = setupTest(__dirname, "./resources/integration");
  client.defaults.auth = { username: "yves", password: "" };
  const t2User = { username: "theo-on-tenant-2", password: "any" };

  const cds = cwdRequireCDS();

  const { getColumns, getTables, getTenantDatabaseName } = require("../src/admin-tool");

  afterAll(doAfterAll);

  it("should support multi-tenancy", async () => {
    let response = await client.post(
      "/odata/v4/bank/Peoples",
      { Name: "Theo in Defualt Tenant" },
      {
        auth: { username: "alice", password: "admin" }
      }
    );
    expect(response.status).toBe(201);
    response = await client.get("/odata/v4/bank/Peoples/$count");
    expect(response.data).toBe(1);
    response = await client.get("/odata/v4/bank/Peoples", { auth: t2User });
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


  it("should support upgrade all tenant", async () => {
    const { status } = await client.post(
      "/-/cds/deployment/upgrade",
      {
        "tenant": NEW_TENANT_ID
      }
    );
    expect(status).toMatchInlineSnapshot(`204`);
  });

  it("should support get tables/columns", async () => {
    const tables = await getTables(NEW_TENANT_ID);
    expect(tables.length).toBeGreaterThan(0);
    const columns = await getColumns(tables[0], NEW_TENANT_ID);
    expect(columns.length).toBeGreaterThan(0);
  });

  it("should support add extension fields", async () => {
    const { data: m1 } = await client.get("/odata/v4/bank/$metadata", { auth: t2User });
    expect(m1).not.toMatch(/zz_ExtValue/);
    expect(m1).not.toMatch(/zz_ChineseName/);

    const sh = createSh({
      cwd: path.join(__dirname, "./resources/_integration_ext_"),
      env: process.env,
      shell: true
    });

    await sh("npx", "cds", "pull", "-u", "theo-on-tenant-2:pass", "--from", client.defaults.baseURL);
    await sh("npx", "cds", "push", "-u", "theo-on-tenant-2:pass", "--to", client.defaults.baseURL);

    await sleep(10000); // wait cache expired

    const { status, data } = await client.get("/odata/v4/bank/$metadata", { auth: t2User });
    expect(status).toMatchInlineSnapshot(`200`);
    expect(data).toMatch(/zz_ExtValue/);
    expect(data).toMatch(/zz_ChineseName/);
  });

  it("should raise error when tenant-id too long", () => {

    expect(() => getTenantDatabaseName(cds.utils.uuid() + cds.utils.uuid()))
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
