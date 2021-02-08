// @ts-nocheck
import cds from "@sap/cds";
import cds_deploy from "@sap/cds/lib/db/deploy";
import path from "path";

describe('CDS MySQL Basic Test Suite', () => {

  it('should support deploy ', async () => {
    cds.env.requires.db = { kind: "mysql" };
    cds.env.requires.mysql = {
      kind: "mysql",
      impl: path.join(__dirname, "../src"),
      credentials: {
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT),
      }
    };
    const csn = await cds.load(path.join(__dirname, "./resources/people.cds"));
    await cds_deploy(csn).to("mysql");

  });

});