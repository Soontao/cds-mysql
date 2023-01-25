
(async function () {

  const Benchmark = require("benchmark");
  const path = require("path");
  const suite = new Benchmark.Suite;

  const { cwdRequireCDS } = require("cds-internal-tool");
  const { sqlFactory } = require("../lib/sqlFactory");
  const customBuilder = require("../lib/customBuilder");
  const cds = cwdRequireCDS();
  const { SELECT, INSERT, UPDATE, DELETE } = cds.ql;
  const model = cds.compile.for.nodejs(await cds.load(
    "*",
    { root: path.join(__dirname, "../test/resources/integration") }
  ));

  function sql(query) {
    return sqlFactory(
      query,
      {
        dialect: "sqlite",
        customBuilder,
        now: "2022-11-22 14:54:59.000",
        user: "theo.sun@not.existed.com",
      },
      model
    );
  }
  suite.add("query#select_limit", function () {
    sql(SELECT.from("test.int.People").limit(10, 10));
  });

  suite.add("query#select_projection_where", function () {
    sql(
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
  });

  suite.add("query#select_from_inner_table", function () {
    sql(SELECT.from(SELECT.from("B").where("A =", "cc")).where({ c: 1 }));
  });

  suite.add("query#insert_into_entries", function () {
    sql(INSERT.into("A").entries({ a: 1, b: "5", c: 3 }, { a: 3, b: "3", c: 5 }));
  });

  suite.add("query#insert_into_as_select", function () {
    sql(INSERT.into("A").as(SELECT.from("B")));
  });

  suite.add("query#update_where_set", function () {
    sql(UPDATE.entity("test.int.People").where({ ID: "1" }).set({ Name: "1" }));
  });

  suite.add("query#update_with", function () {
    sql(UPDATE.entity("test.int.People").with({ ID: 1, Name: "uu" }));
  });

  suite.add("query#delete_all", function () {
    sql(DELETE.from("A"));
  });

  suite.add("query#delete_simple_where", function () {
    sql(DELETE.from("A").where({ A: 1 }));
  });

  suite.add("query#delete_complicated_where", function () {
    sql(DELETE.from("test.int.People").where({
      Name: { "=": "Theo" },
      Age: { "<=": 15 },
      RegisterDate: {
        between: "2022-11-17",
        and: "2022-11-17"
      }
    }));
  });

  suite.on("cycle", event => {
    console.log(String(event.target));
  });

  suite.run({ async: true });
})().catch(console.error);
