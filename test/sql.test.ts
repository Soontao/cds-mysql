import { cwdRequireCDS, CSN } from "cds-internal-tool";
import path from "path";
import { sqlFactory } from "../src/sqlFactory";
import CustomBuilder from "../src/customBuilder";

describe("SQL Factory Test Suite", () => {

  const cds = cwdRequireCDS();
  let model: CSN;

  const { SELECT } = cds.ql;

  beforeAll(async () => {
    model = await cds.load(
      "*",
      { root: path.join(__dirname, "./resources/integration") }
    );
  });

  function toSQL(query: any) {
    return sqlFactory(query, { dialect: "sqlite", customBuilder: CustomBuilder }, model);
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


});