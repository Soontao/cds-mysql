// @ts-nocheck
import { cwdRequireCDS } from "cds-internal-tool";
import path from "path";
import { doAfterAll, setupEnv } from "./utils";

describe("Ref Test Suite", () => {

  const cds = cwdRequireCDS();

  setupEnv();

  afterAll(doAfterAll);

  it("should support reference query", async () => {
    const csn = await cds.load(path.join(__dirname, "./resources/reference.cds"));
    await cds.deploy(csn).to("mysql");
    const People = csn.definitions["test.resources.ref.People2"];
    const Detail = csn.definitions["test.resources.ref.Detail2"];

    // no error
    await cds.run(SELECT.from(People).where({
      ID: {
        in: SELECT.from(Detail).columns("PeopleID")
      }
    }));
  });

});