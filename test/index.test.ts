import cds from "@sap/cds";
import path from "path";

describe('Demo Test Suite', () => {

  it('should equal to 1', async () => {
    const csn = await cds.load(path.join(__dirname, "./resources/people.cds"));
    const sql = cds.compile(csn).to.sql();

  });

});