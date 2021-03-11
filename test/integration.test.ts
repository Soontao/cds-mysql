// @ts-nocheck
import sleep from "@newdash/newdash/sleep";
import cds from "@sap/cds";
import cds_deploy from "@sap/cds/lib/db/deploy";
import { readFileSync } from "fs";
import path from "path";
import { cleanDB, createRandomName } from "./utils";



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


  afterAll(async () => {
    await sleep(100);
    await cleanDB();
  });

});
