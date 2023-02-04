/* eslint-disable max-len */
import { setupTest } from "cds-internal-tool";
import path from "node:path";
import { Query } from "typeorm/driver/Query";
import { createSh, doAfterAll, loadCSN, loadMigrateStepCSN } from "./utils";
import fs from "node:fs/promises";


describe("transparent Test Suite", () => {
  const client = setupTest(__dirname, "./resources/transparent");
  client.defaults.auth = { username: "alice", password: "admin" };

  afterAll(doAfterAll);

  it("should support get metadata", async () => {
    const response = await client.get("/fiori/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Persons/);
  });

  it("should support generate transparent migration script", async () => {
    const { build_migration_scripts_from_csn } = require("../src/typeorm/transparent");

    const files = await fs.readdir(path.join(__dirname, "./resources/migrate"));

    // do migration one by one
    for (let idx = 1; idx <= files.length; idx++) {
      const migration_id = `${idx - 1}->${idx}`;
      const current_csn = await loadCSN(`./resources/migrate/step-${idx}.cds`);
      const previous_csn = idx > 1 ? await loadCSN(`./resources/migrate/step-${idx - 1}.cds`) : undefined;
      const queries: Array<Query> = await build_migration_scripts_from_csn(current_csn, previous_csn);
      expect(queries.map(q => q.query).join("\n")).toMatchSnapshot(`transparent migration - ${migration_id}`);
    }

  });

  it("should never drop column when only resize the column", async () => {
    const { build_migration_scripts_from_csn } = require("../src/typeorm/transparent");
    const queries: Array<Query> = await build_migration_scripts_from_csn(
      await loadMigrateStepCSN(14), // new
      await loadMigrateStepCSN(13), // old
    );
    expect(queries).toMatchSnapshot();
  });

  it("should raise error when extend extension", async () => {

    const sh = createSh({
      cwd: path.join(__dirname, "./resources/_fiori_ext_"),
      env: process.env,
      shell: true,
      stdPipe: false
    });

    await sh("npx", "cds", "pull", "-u", "theo-on-tenant-2:pass", "--from", client.defaults.baseURL);
    await sh("npx", "cds", "build", "--for", "mtx-extension");
    const code = await sh(
      "npx", "cds", "push", "./gen/extension.tgz", "-u", "theo-on-tenant-2:pass", "--to",
      client.defaults.baseURL
    );

    expect(code).toBe(1); // should failed

    const response = await client.get("/fiori/$metadata", {
      auth: {
        username: "theo-on-tenant-2",
        password: "pass"
      }
    });

    expect(response.data).not.toMatch(/zz_ExtValue/);

  });
});