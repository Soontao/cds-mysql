/* eslint-disable max-len */
import { setupTest } from "cds-internal-tool";
import path from "node:path";
import { createSh, doAfterAll } from "./utils";

describe("transparent Test Suite", () => {
  const client = setupTest(__dirname, "./resources/transparent");
  client.defaults.auth = { username: "alice", password: "admin" };

  afterAll(doAfterAll);

  it("should support get metadata", async () => {
    const response = await client.get("/fiori/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Persons/);
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