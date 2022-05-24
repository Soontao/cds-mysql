import { sleep } from "@newdash/newdash";
import { cwdRequireCDS } from "cds-internal-tool";
import path from "path";
import { cleanDB, setupEnv } from "./utils";

describe("Ref Test Suite", () => {

  const cds = cwdRequireCDS();

  const cds_deploy = require("@sap/cds/lib/deploy");
  
  beforeAll(() => {
    setupEnv();
  });

  it("should support reference query", async () => {
    const csn = await cds.load(path.join(__dirname, "./resources/reference.cds"));
    await cds_deploy(csn).to("db");
    const People = csn.definitions["test.resources.ref.People2"];
    const Detail = csn.definitions["test.resources.ref.Detail2"];

    // no error
    await cds.run(SELECT.from(People).where({
      ID: {
        in: SELECT.from(Detail).columns("PeopleID")
      }
    }));
  });

  afterAll(async () => {
    await sleep(100);
    await cleanDB();
  });


});