import cds from "@sap/cds";
import cds_deploy from "@sap/cds/lib/db/deploy";
import path from "path";
import { setupEnv } from "./utils";

describe("Ref Test Suite", () => {

  beforeAll(() => {
    setupEnv();
  });

  it("should support reference query", async () => {
    const csn = await cds.load(path.join(__dirname, "./resources/reference.cds"));
    await cds_deploy(csn).to("mysql");
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