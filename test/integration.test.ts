// @ts-nocheck

import { readFileSync } from "fs";
import path from "path";
import { createRandomName, doAfterAll } from "./utils";
import { cwdRequireCDS, setupTest } from "cds-internal-tool";


describe("Integration Test Suite", () => {

  const cds = cwdRequireCDS();
  const client = setupTest(__dirname, "./resources/integration");
  client.defaults.auth = { username: "alice", password: "admin" };

  afterAll(doAfterAll);

  it("should support basic query", async () => {
    const response = await client.get("/bank/Peoples");
    expect(response.data.value.length).toBe(0);
  });

  it("should support consume CAP API with rest call", async () => {

    const { data: created } = await client.post("/bank/Peoples", { Name: "Theo Sun", Age: 21 });
    expect(created.ID).not.toBeUndefined();
    const response = await client.get("/bank/Peoples/$count");
    expect(response.data).toBe(1);
    await client.patch(`/bank/Peoples(${created.ID})`, { Age: 25 });
    const { data: retrieveResult } = await client.get(`/bank/Peoples(${created.ID})`);
    expect(retrieveResult.Age).toBe(25);

  });

  it("should support deep insert & expand data", async () => {

    const name = createRandomName();
    const addr = createRandomName();
    const { data: created } = await client.post("/bank/Peoples", {
      Name: name,
      Age: 21,
      Detail: {
        BirthDay: "1995-11-11",
        Address: addr
      }
    });

    const { data: retrievedItem } = await client.get(`/bank/Peoples(${created.ID})?$expand=Detail`);

    expect(retrievedItem.Name).toBe(name);
    expect(retrievedItem.Detail.Address).toBe(addr);

  });

  it("should support complex query & association", async () => {

    const name = createRandomName();
    const addr = createRandomName();
    const { data: createdPeople } = await client.post("/bank/Peoples", {
      Name: name,
      Age: 21,
      RegisterDate: "2000-01-01",
      Detail: {
        BirthDay: "1901-11-11",
        Address: addr
      }
    });

    expect(createdPeople?.ID).not.toBeUndefined();

    const { data: retrievedItem } = await client.get(
      `/bank/Peoples?$filter=year(RegisterDate) eq 2000 and substring(Name,0,4) eq '${name.substring(0, 4)}'`
    );
    expect(retrievedItem?.value?.[0]?.Name).toBe(name);

    const { data: retrievedItem2 } = await client.get(
      `/bank/Peoples?$filter=contains(Name,'${name.substring(0, 4)}')`
    );
    expect(retrievedItem2?.value?.[0]?.Name).toBe(name);

    const { data: createdCard } = await client.post("/bank/Cards", {
      People_ID: createdPeople?.ID,
      Number: "Card Number 01",
      ExampleDT1: null,
    });

    expect(createdCard).not.toBe(undefined);

    expect(createdCard.Active).toBeFalsy();

    const { data: createdPeopleCards } = await client.get(`/bank/Peoples(${createdPeople.ID})/Cards`);

    expect(createdPeopleCards.value).toHaveLength(1);

    const { data: createdCard2 } = await client.post("/bank/Cards", {
      People_ID: createdPeople?.ID,
      Number: "Card Number 02",
      ExampleDT1: null,
      Active: true
    });

    expect(createdCard2.Active).toBeTruthy();

    const { data: { value: queryCards } } = await client.get("/bank/Cards?$filter=Active eq true");

    expect(queryCards).toHaveLength(1);

    expect(queryCards[0].ID).toBe(createdCard2.ID);

  });

  it("should support create stream media data", async () => {

    const name = createRandomName();
    const addr = createRandomName();

    const { data: createdPeople } = await client.post("/bank/Peoples", {
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

    await client.put(attachmentUri, data);

    const { data: buff } = await client.get(attachmentUri, { responseType: "arraybuffer" });

    expect(buff).toStrictEqual(data);

  });

  // debug: node_modules/@sap/cds/lib/compile/etc/_localized.js
  it("should support localized data", async () => {
    // TODO: document about the https://cap.cloud.sap/docs/guides/localized-data
    const PRODUCTS = "/bank/Products";
    const apple_en = "Apple";
    const apple_fr = "Pomme 🍎";

    const { data } = await client.request({
      url: PRODUCTS,
      method: "post",
      data: {
        Name: apple_en
      }
    });
    await client.request({
      method: "post",
      url: `${PRODUCTS}(${data.ID})/texts`,
      data: {
        Name: apple_fr,
        locale: "fr"
      }
    });

    const { data: data2 } = await client.request({ url: `${PRODUCTS}(${data.ID})`, method: "get" });
    expect(data2.Name).toBe(apple_en);

    const { data: data3 } = await client.request({
      url: `${PRODUCTS}(${data.ID})`,
      method: "get",
      headers: {
        "accept-language": "fr"
      }
    });
    expect(data3.Name).toBe(apple_fr);

  });

  it("should connected to db", async () => {
    expect(cds.db).not.toBeUndefined();
    expect(cds.db).toBeInstanceOf(require("../src/index"));
  });

  it("should support create animal with incremental ID", async () => {
    let res = await client.get("/bank/DummyAnimals", { validateStatus: () => true });
    expect(res.status).toBe(200);
    res = await client.post("/bank/DummyAnimals",
      { Name: "horse 1" },
      { validateStatus: () => true }
    );
    expect(res.status).toBe(201);
    expect(res.data.ID).not.toBeUndefined();
    const { results } = await cds.run(
      INSERT
        .into("test.resources.integration.BankService.DummyAnimals")
        .entries({ Name: "horse 2" }, { Name: "horse 3" })
    );

    expect(results).toHaveLength(1);
    expect(results[0].affectedRows).toBe(2);
  });



});
