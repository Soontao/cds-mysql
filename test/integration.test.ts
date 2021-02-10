// @ts-nocheck
import sleep from "@newdash/newdash/sleep";
import cds from "@sap/cds";
import cds_deploy from "@sap/cds/lib/db/deploy";
import path from "path";
import { createRandomName } from "./utils";


describe("Integration Test Suite", () => {

  cds.env._home = path.join(__dirname, "./resources/integration");
  const server = cds.test(".").in(__dirname, "./resources/integration");
  cds.env.requires.db = {
    impl: path.join(__dirname, "../src"),
    credentials: {
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      host: process.env.MYSQL_HOST,
      port: parseInt(process.env.MYSQL_PORT),
    }
  };

  beforeAll(async () => {
    const csn = await cds.load([
      path.join(__dirname, "./resources/integration/srv"),
      path.join(__dirname, "./resources/integration/db")
    ]);
    await cds_deploy(csn).to("db");
  });

  it("should support basic query", async () => {
    const response = await server.GET("/bank/Peoples");
    expect(response.data.value.length).toBe(0);
  });

  it("should support consume CAP API with rest call", async () => {

    const { data: created } = await server.POST("/bank/Peoples", { Name: "Theo Sun", Age: 21 });
    expect(created.ID).not.toBeUndefined();
    const response = await server.GET("/bank/Peoples/$count");
    expect(response.data).toBe(1);
    await server.PATCH(`/bank/Peoples(${created.ID})`, { Age: 25 });
    const { data: retrieveResult } = await server.GET(`/bank/Peoples(${created.ID})`);
    expect(retrieveResult.Age).toBe(25);

  });

  it("should support deep insert & expand data", async () => {

    const name = createRandomName();
    const addr = createRandomName();
    const { data: created } = await server.POST("/bank/Peoples", {
      Name: name,
      Age: 21,
      Detail: {
        BirthDay: "1995-11-11",
        Address: addr
      }
    });

    const { data: retrievedItem } = await server.GET(`/bank/Peoples(${created.ID})?$expand=Detail`);

    expect(retrievedItem.Name).toBe(name);
    expect(retrievedItem.Detail.Address).toBe(addr);

  });

  it("should support complex query", async () => {

    const name = createRandomName();
    const addr = createRandomName();
    const { data: created } = await server.POST("/bank/Peoples", {
      Name: name,
      Age: 21,
      RegisterDate: "2000-01-01",
      Detail: {
        BirthDay: "1901-11-11",
        Address: addr
      }
    });

    expect(created?.ID).not.toBeUndefined();

    const { data: retrievedItem } = await server.GET(`/bank/Peoples?$filter=year(RegisterDate) eq 2000 and substring(Name,0,4) eq '${name.substring(0, 4)}'`);
    expect(retrievedItem?.value?.[0]?.Name).toBe(name);

  });

  afterAll(async () => {
    await sleep(100);
  });

});
