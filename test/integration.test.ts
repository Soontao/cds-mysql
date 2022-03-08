// @ts-nocheck
import sleep from "@newdash/newdash/sleep";
import cds from "@sap/cds";
import { CSN } from "@sap/cds/apis/csn";
import cds_deploy from "@sap/cds/lib/deploy";
import axios, { AxiosInstance } from "axios";
import { readFileSync } from "fs";
import path from "path";
import MySQLDatabaseService from "../src";
import { migrateData } from "../src/typeorm";
import { cleanDB, createRandomName } from "./utils";


describe("Integration Test Suite", () => {

  cds.env._home = path.join(__dirname, "./resources/integration");
  cds.env.i18n.for_sqlite = ["en", "zh_CN"]; // this configure will used for create view
  cds.env.requires.db = {
    impl: path.join(__dirname, "../src"),
    credentials: {
      user: process.env.CDS_MYSQL_USER,
      password: process.env.CDS_MYSQL_PASSWORD,
      database: process.env.CDS_MYSQL_DATABASE,
      host: process.env.CDS_MYSQL_HOST,
      port: parseInt(process.env.CDS_MYSQL_PORT),
    }
  };
  const server = cds.test(".").in(__dirname, "./resources/integration");
  const ENTITIES = {
    PEOPLE: "People"
  };
  let client: AxiosInstance;
  let db: MySQLDatabaseService;
  let csn: CSN;

  beforeAll(async () => {
    csn = await cds.load([
      path.join(__dirname, "./resources/integration/srv"),
      path.join(__dirname, "./resources/integration/db")
    ]);
    await cds_deploy(csn).to("db");
    db = await cds.connect.to("db");
    client = axios.create({ baseURL: server.url });
  });

  it("should support basic query", async () => {
    const response = await client.get("/bank/Peoples");
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

  it("should support complex query & association", async () => {

    const name = createRandomName();
    const addr = createRandomName();
    const { data: createdPeople } = await server.POST("/bank/Peoples", {
      Name: name,
      Age: 21,
      RegisterDate: "2000-01-01",
      Detail: {
        BirthDay: "1901-11-11",
        Address: addr
      }
    });

    expect(createdPeople?.ID).not.toBeUndefined();

    const { data: retrievedItem } = await server.GET(
      `/bank/Peoples?$filter=year(RegisterDate) eq 2000 and substring(Name,0,4) eq '${name.substring(0, 4)}'`
    );
    expect(retrievedItem?.value?.[0]?.Name).toBe(name);

    const { data: retrievedItem2 } = await server.GET(
      `/bank/Peoples?$filter=contains(Name,'${name.substring(0, 4)}')`
    );
    expect(retrievedItem2?.value?.[0]?.Name).toBe(name);

    const { data: createdCard } = await server.POST("/bank/Cards", {
      People_ID: createdPeople?.ID,
      Number: "Card Number 01",
      ExampleDT1: null,
    });

    expect(createdCard).not.toBe(undefined);

    expect(createdCard.Active).toBeFalsy();

    const { data: createdPeopleCards } = await server.GET(`/bank/Peoples(${createdPeople.ID})/Cards`);

    expect(createdPeopleCards.value).toHaveLength(1);

    const { data: createdCard2 } = await server.POST("/bank/Cards", {
      People_ID: createdPeople?.ID,
      Number: "Card Number 02",
      ExampleDT1: null,
      Active: true
    });

    expect(createdCard2.Active).toBeTruthy();

    const { data: { value: queryCards } } = await server.GET("/bank/Cards?$filter=Active eq true");

    expect(queryCards).toHaveLength(1);

    expect(queryCards[0].ID).toBe(createdCard2.ID);

  });

  it("should support create stream media data", async () => {

    const name = createRandomName();
    const addr = createRandomName();

    const { data: createdPeople } = await server.POST("/bank/Peoples", {
      Name: name,
      Age: 23,
      RegisterDate: "2000-01-01",
      Detail: {
        BirthDay: "1901-11-11",
        Address: addr
      }
    });

    expect(createdPeople?.Detail?.ID).not.toBeUndefined();

    const attachmentUri = `/bank/Details(${createdPeople.Detail.ID})/Attachment`;
    const fileLocation = path.join(__dirname, "./tsconfig.json");

    const data = readFileSync(fileLocation);

    await server.PUT(attachmentUri, data);

    const { data: buff } = await server.GET(attachmentUri, { responseType: "arraybuffer" });

    expect(buff).toStrictEqual(data);

  });

  // broken after 5.x release, the model has changed
  it.skip("should support localized data", async () => {
    const PRODUCTS = "/bank/Products";
    const apple_en = "Apple";
    const apple_zh = "苹果🍎";

    const { data } = await client.request({
      url: PRODUCTS,
      method: "post",
      data: {
        Name: apple_en
      },
      headers: {
        "accept-language": "en"
      }
    });
    await client.request({
      url: `${PRODUCTS}(${data.ID})/texts`,
      method: "POST",
      data: {
        Name: apple_zh,
        locale: "zh_CN"
      }
    });

    const { data: data2 } = await client.request({ url: `${PRODUCTS}(${data.ID})`, method: "get" });
    expect(data2.Name).toBe(apple_en);

    const { data: data3 } = await client.request({
      url: `${PRODUCTS}(${data.ID})`,
      method: "get",
      headers: {
        "accept-language": "zh_CN"
      }
    });
    expect(data3.Name).toBe(apple_zh);

  });

  it("should connected to db", async () => {
    expect(db).not.toBeUndefined();
    expect(db).toBeInstanceOf(MySQLDatabaseService);
  });

  it("should support migrate csv data", async () => {

    const migrateTo = async (version: string) => migrateData(
      db,
      [path.join(__dirname, `./resources/integration/db/data/${version}/test_resources_integration_People.csv`)],
      csn
    );
    await migrateTo("v1");
    const people5 = await cds.run(
      SELECT
        .one
        .from(ENTITIES.PEOPLE)
        .where({ Name: "People5" })
    );
    expect(people5).not.toBeNull();
    expect((people5.ID)).toBe("e3cf83a0-2d99-11ec-8d3d-0242ac130003");

    await migrateTo("v2");
    const people1000005 = await cds.run(
      SELECT
        .one
        .from(ENTITIES.PEOPLE)
        .byKey("e3cf83a0-2d99-11ec-8d3d-0242ac130003")
    );
    expect(people1000005).not.toBeNull();
    expect(people1000005.Name).toBe("People1000005");
    expect(people1000005.Age).toBe(18);

    await migrateTo("v3");
    const peopleWithAge9999 = await cds.run(
      SELECT
        .one
        .from(ENTITIES.PEOPLE)
        .byKey("e3cf7edc-2d99-11ec-8d3d-0242ac130003")
    );
    expect(peopleWithAge9999).not.toBeNull();
    expect(peopleWithAge9999.Name).toBe("PeopleWithAge9999");
    expect(peopleWithAge9999.Age).toBe(9999);

    // original also existed
    expect(await cds.run(
      SELECT
        .one
        .from(ENTITIES.PEOPLE)
        .byKey("e3cf83a0-2d99-11ec-8d3d-0242ac130003")
    )).toMatchObject({
      Name: "People1000005",
      Age: 18,
    });

  });


  afterAll(async () => {
    await sleep(100);
    await cleanDB();
  });

});
