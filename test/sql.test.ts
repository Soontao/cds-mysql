import { cwdRequireCDS, CSN } from "cds-internal-tool";
import path from "path";
import { sqlFactory } from "../src/sqlFactory";
import CustomBuilder from "../src/customBuilder";

describe("SQL Factory Test Suite", () => {

  const cds = cwdRequireCDS();
  let model: CSN;

  const { SELECT, INSERT } = cds.ql;

  beforeAll(async () => {
    model = cds.reflect(cds.compile.for.nodejs(await cds.load(
      "*",
      { root: path.join(__dirname, "./resources/integration") }
    )));
  });

  function toSQL(query: any) {
    return sqlFactory(
      query,
      { dialect: "sqlite", customBuilder: CustomBuilder, now: "2022-11-22T14:54:59.340Z" },
      model
    );
  }

  it("should support build a simple SELECT query", () => {
    const r = toSQL(SELECT.from("test.int.People"));
    expect(r.sql).toMatchSnapshot();
  });



  it("should support build a complex SELECT projection", () => {
    // REVISIT: maybe select between datetime will have issue
    const r = toSQL(
      SELECT.from("test.int.People").columns("Name", "Age", "RegisterDate").where(
        {
          Name: { "=": "Theo" },
          Age: { "<=": 15 },
          RegisterDate: {
            between: "2022-11-17",
            and: "2022-11-17"
          }
        }
      )
    );
    expect(r).toMatchSnapshot();
  });

  it("should support insert columns", () => {
    const ID = "c83b5945-f7c2-48f0-ad6f-0e9b048ab2e3";
    const r = toSQL(
      INSERT.into("test.int.People").columns("ID", "Name", "Age", "RegisterDate").values(ID, "Theo", 15, "2022-11-17")
    );
    expect(r).toMatchSnapshot();
  });

  it("should support build a SELECT FOR UPDATE query", () => {
    const r = toSQL(SELECT.from("test.int.People").where({ Name: "Theo" }).forUpdate());
    expect(r).toMatchSnapshot();
  });

  it("should support build a SELECT FOR SHARE LOCK query", () => {
    const r = toSQL(SELECT.from("test.int.People").where({ Name: "Theo" })["forShareLock"]());
    expect(r).toMatchSnapshot();
  });


});