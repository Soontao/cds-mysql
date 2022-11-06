// @ts-nocheck

import { createRandomName, doAfterAll } from "./utils";
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import { randomBytes } from "node:crypto";
import { DateTime } from "luxon";

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

    expect(createdPeople.error).toBeUndefined();
    expect(createdPeople?.ID).not.toBeUndefined();
    expect(createdPeople.RegisterDate).toMatchInlineSnapshot(`"2000-01-01"`);
    expect(createdPeople.Detail.BirthDay).toMatchInlineSnapshot(`"1901-11-11"`);

    // test with odata function
    const { data: retrievedItem } = await client.get(
      `/bank/Peoples?$filter=year(RegisterDate) eq 2000 and substring(Name,0,4) eq '${name.substring(0, 4)}'`
    );
    expect(retrievedItem?.value?.[0]?.Name).toBe(name);

    const concatR1 = await client.get(
      `/bank/Peoples?$filter=concat(Name,'1') eq '${name}1'`
    );

    expect(concatR1.status).toBe(200);
    expect(concatR1.data.value).toHaveLength(1);

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

    // TODO: add validation for max_allowed_packet
    const data = randomBytes(1024 * 1024);

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
        .into("test.int.BankService.DummyAnimals")
        .entries({ Name: "horse 2" }, { Name: "horse 3" })
    );

    expect(results).toHaveLength(1);
    expect(results[0].affectedRows).toBe(2);
  });


  it("should support create temporal data", async () => {

    await client.post("/bank/ExchangeRates", {
      Source_code: "USD",
      Target_code: "CNY",
      Rate: 123.22,
      validFrom: DateTime.utc().startOf("day").minus({ days: 2 }).toISO(),
      validTo: DateTime.utc().startOf("day").minus({ days: 1 }).toISO()
    });


    await client.post("/bank/ExchangeRates", {
      Source_code: "USD",
      Target_code: "CNY",
      Rate: 123.21,
      validFrom: DateTime.utc().startOf("day").minus({ days: 1 }).toISO(),
      validTo: DateTime.utc().startOf("day").plus({ days: 2 }).toISO()
    });

    const { data } = await client.get("/bank/ExchangeRates");
    expect(data).toMatchObject({
      value: [
        { "Rate": 123.21 }
      ]
    });

  });

  it("should support select forUpdate", async () => {

    const { data: createdCard } = await client.post("/bank/Cards", {
      Number: "Card Number 03",
      ExampleDT1: null,
      Credit: 0,
      Debit: 0,
    });

    expect(createdCard.ID).not.toBeUndefined();

    await Promise.all(
      Array(10).fill(0).map(() => client.post("/bank/AddOneCreditToCard", {
        ID: createdCard.ID
      }))
    );

    const s = await client.get(`/bank/Cards(${createdCard.ID})`);
    expect(s.data.Credit).toBe(10);
  });


});
