/* eslint-disable max-len */
import { CSN, cwdRequireCDS } from "cds-internal-tool";
import { QueryObject } from "cds-internal-tool/lib/types/ql";
import path from "path";
import CustomBuilder from "../src/customBuilder";
import { MySQLDatabaseService } from "../src/Service";
import { sqlFactory } from "../src/sqlFactory";

describe("SQL Factory Test Suite", () => {


  const { UPSERT } = MySQLDatabaseService;

  const cds = cwdRequireCDS();
  let model: CSN;

  const { SELECT, INSERT, UPDATE, DELETE, CREATE, DROP } = cds.ql;

  beforeAll(async () => {
    model = cds.compile.for.nodejs(await cds.load(
      "*",
      { root: path.join(__dirname, "./resources/integration") }
    ));
  });

  function toSQL(query: any) {
    return sqlFactory(
      query,
      { dialect: "sqlite", customBuilder: CustomBuilder, now: "2022-11-22 14:54:59.0", user: "theo.sun@not.existed.com" },
      model
    );
  }

  function expect_sql(query: QueryObject, label: string = "default") {
    return expect(toSQL(query)).toMatchSnapshot(label);
  }

  it("should raise error when cqn lost", () => {
    expect(() => sqlFactory(undefined)).toThrowError("Cannot build SQL. No CQN object provided.");
  });

  it("should raise error when cqn wrong", () => {
    expect(() => toSQL({})).toThrowError("Cannot build SQL. Invalid CQN object provided");
  });

  it("should support build sql with 2 parameter", () => {
    expect(sqlFactory(SELECT.from("a"), model)).toMatchSnapshot();
  });

  it("should support access all builders", () => {

    expect(CustomBuilder.DeleteBuilder).toBeDefined();
    expect(CustomBuilder.UpdateBuilder).toBeDefined();
    expect(CustomBuilder.ExpressionBuilder).toBeDefined();
    expect(CustomBuilder.InsertBuilder).toBeDefined();
    expect(CustomBuilder.ReferenceBuilder).toBeDefined();
    expect(CustomBuilder.SelectBuilder).toBeDefined();

  });

  it("should support build a simple SELECT query", () => {
    expect_sql(
      SELECT.from("test.int.People")
    );
  });

  it("should support build a complex SELECT projection", () => {
    expect_sql(
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

  it("should support insert data into existed entity", async () => {
    expect_sql(
      INSERT.into("test.int.People").entries({ ID: "test-id", Name: "Theo Sun" })
    );
  });

  it("should support update date into existed entity", () => {
    expect_sql(
      UPDATE.entity("test.int.People").where({ ID: "test-id" }).set({ Name: "New Name" })
    );
  });

  it("should support insert data with given value", () => {
    expect_sql(
      INSERT.into("test.int.People").entries({
        ID: "test-id",
        Name: "Theo Sun",
        createdAt: "2022-12-10T12:05:34.000Z",
        createdBy: "usr0",
      })
    );
    expect_sql(
      INSERT.into("test.int.People").entries({
        ID: "test-id",
        Name: "Theo Sun",
        createdAt: "2022-12-10T20:05:34.000+08:00",
        createdBy: "usr0",
      }),
      "with time zone"
    );
    expect_sql(
      INSERT.into("test.int.People").entries({
        ID: "test-id-2",
        Name: "Theo Sun", createdAt: "2022-12-10 12:05:34", createdBy: "usr0"
      }),
      "with mysql date time"
    );

  });

  it("should support insert with given datetime", () => {
    const d = "2022-12-10T12:05:34.000Z";
    expect_sql(
      INSERT.into("test.int.Card").entries({
        ID: "test-id-2",
        ExampleTS2: d, createdBy: "usr0"
      })
    );

  });

  it("should support select with complex where", () => {

    expect_sql(
      SELECT.from("Foo").where({
        name: { like: "%foo%" }, and: {
          kind: { in: ["k1", "k2"] },
          or: {
            ratio: { between: 0, and: 10 },
            or: { stock: { ">=": 25 } }
          }
        }
      })
    );
  });

  it("should support select with groupBy", () => {
    expect_sql(
      SELECT.from("foo").columns("count(1) as total", "c1", "c2").groupBy("c1", "c2")
    );
  });

  it("should support select sub query with alias", () => {
    // @ts-ignore
    expect_sql(SELECT.from("bar").columns("count(1) as cc").from(SELECT.from("foo").limit(1000, 0)).limit(1000, 0));
    // @ts-ignore
    expect_sql(SELECT.from("bar").columns("count(1) as cc").from(SELECT.from("foo").limit(1000, 0).alias("not_important_t_1")).limit(1000, 0), "with alias");
  });

  it("should support select with order by and limit", () => {

    expect_sql(
      SELECT.from("foo").limit(10, 5)
    );

    expect_sql(
      SELECT.from("boo").orderBy("c1").limit(5, 3)
    );

    expect_sql(
      SELECT.from("boo").orderBy("c2 desc", "c1 asc").limit(5, 3)
    );

  });

  it("should support query with aggregation", () => {
    expect_sql(
      SELECT.from("t1").columns("count(1) as total")
    );
  });


  it("should support insert columns", () => {
    const ID = "c83b5945-f7c2-48f0-ad6f-0e9b048ab2e3";
    expect_sql(
      INSERT.into("test.int.People").columns("ID", "Name", "Age", "RegisterDate").values(ID, "Theo", 15, "2022-11-17")
    );
  });

  it("should support build a SELECT FOR UPDATE query", () => {
    expect_sql(
      SELECT.from("test.int.People").where({ Name: "Theo" }).forUpdate()
    );
  });

  it("should support build a SELECT FOR SHARE LOCK query", () => {
    expect_sql(
      SELECT.from("test.int.People").where({ Name: "Theo" }).forShareLock()
    );
  });

  it("should support select for update", () => {
    expect_sql(
      SELECT.from("A").where({ a: 1 }).forShareLock(),
      "share lock"
    );

    expect_sql(
      SELECT.from("A").where({ b: 1 }).forUpdate(),
      "for update lock"
    );

    expect_sql(
      SELECT.from("A").where({ c: 2 }).forUpdate({ wait: 10 }),
      "for update lock not supported"
    );

  });

  it("should support select where exists", () => {
    expect_sql(
      SELECT.from("Authors as a")
        .where({ exists: SELECT.from("Books").where("author_ID = a.ID") })
    );
  });


  it("should support insert with select query", () => {
    expect_sql(INSERT.into("b").as(SELECT.from("a")));
    expect_sql(INSERT.into("b").as(SELECT.from("a").where({ b: 1 })), "with condition");
    expect_sql(
      INSERT
        .into("b")
        .columns("c1", "c2")
        .as(SELECT.from("a").columns("c1", "c2").where({ b: 1 })),
      "with columns"
    );

  });

  it("should support select with join", () => {
    // @ts-ignore
    expect_sql(SELECT.from("a").join("b").on({ ref: ["a", "a"] }, "=", { ref: ["b", "a"] }));
  });

  it("should support upsert sql", () => {

    expect_sql(
      UPSERT().into("t1").columns("c1", "c2").rows(["v1", "v2"], ["r2_v1", "r2_v2"]), "upsert rows"
    );

    expect_sql(
      UPSERT().into("t1").entries({ c1: "r1_v1", c2: "r1_v2" }, { c1: "r2_v1", c2: "r2_v2" }), "upsert entries"
    );

  });

  it("should support update set", () => {
    const ID = "0849d042-73d0-424e-9c6a-99efcb813104";
    expect_sql(
      UPDATE.entity("test.int.People").where({ ID }).set({ Name: "Name Updated" }), "where set"
    );

    expect_sql(
      UPDATE.entity("test.int.People").where({ ID }).with({ Name: "Name Updated" }), "with"
    );
  });

  it("should support apply function to query", () => {

    expect_sql(
      // @ts-ignore
      SELECT.from("DUMMY").columns({
        func: "max", args: [SELECT.from("a").columns("v")], as: "v"
      })
    );
  });

  it("should support count distinct", () => {

    expect_sql(
      // @ts-ignore
      SELECT.from("v").columns(
        { func: "countdistinct", args: "v" }
      )
    );

    expect_sql(
      // @ts-ignore
      SELECT.from("v").columns(
        { func: "countdistinct", args: [{ ref: ["v", "a"] }] }
      )
    );

  });

  it("should support build ref with function", () => {
    expect_sql(
      // @ts-ignore
      SELECT.from("v").columns(
        {
          func: "count",
          args: [
            { val: 1 },
          ],
          as: "$count"
        }
      ).where(
        { ref: ["v", "d"] },
        "=",
        { func: "concat", args: [{ ref: ["v", "a"] }, { ref: ["v", "b"] }] }
      )
    );
  });

  it("should support delete", () => {
    expect_sql(DELETE.from("a"), "delete all");
    expect_sql(DELETE.from("a").where({ v: 1 }), "delete where");
    expect_sql(DELETE.from("a").where(
      { func: "concat", args: [{ ref: ["a", "a"] }, { ref: ["a", "c"] }] }, "=", { val: "long string" }
    ), "delete where func");
  });

  it("should raise error when use create/drop entity", () => {

    expect(() => toSQL(CREATE.entity(model.definitions["test.int.Card"]))).toThrowError("ERROR_NOT_SUPPORT_CQN_CREATE");
    expect(() => toSQL(DROP.entity(model.definitions["test.int.Card"]))).toThrowError("ERROR_NOT_SUPPORT_CQN_DROP");

  });

});