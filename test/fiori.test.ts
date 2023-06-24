/* eslint-disable max-len */
import { cwdRequireCDS, setupTest } from "cds-internal-tool";
import { doAfterAll } from "./utils";


describe("fiori draft Test Suite", () => {

  const cds = cwdRequireCDS();
  const client = setupTest(__dirname, "./resources/fiori");
  client.defaults.auth = { username: "alice", password: "admin" };

  beforeAll(() => { jest.spyOn(cds.db, "run"); });

  afterAll(doAfterAll);


  it("should support get metadata", async () => {
    const response = await client.get("/fiori/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Persons/);
  });

  const ID = "95f96069-e831-4e30-9567-37a1490b9385";

  it("should support to create instance", async () => {
    const response = await client.post("/fiori/Persons", {
      ID,
      Name: "Theo Sun",
      Age: 26,
    });
    expect(response.data?.error).toBeUndefined();
    expect(response.status).toBe(201);
    expect(response.data).toMatchSnapshot();
  });

  it("should support create records with draft enabled", async () => {
    let draftItemResponse = await client.post("/fiori/Forms", {}, {
      headers: {
        Accept: "application/json;charset=UTF-8;IEEE754Compatible=true"
      }
    });
    expect(draftItemResponse.status).toBe(201);
    expect(draftItemResponse.data).toMatchObject({
      HasActiveEntity: false,
      HasDraftEntity: false,
      IsActiveEntity: false
    });

    const { ID } = draftItemResponse.data;

    draftItemResponse = await client.patch(`/fiori/Forms(ID=${ID},IsActiveEntity=false)`, {
      f1: "value f1"
    });
    expect(draftItemResponse.status).toBe(200);


    // final save create
    draftItemResponse = await client.post(`/fiori/Forms(ID=${ID},IsActiveEntity=false)/draftActivate`);
    expect(draftItemResponse.status).toBe(201);

    // go to edit mode
    draftItemResponse = await client.post(`/fiori/Forms(ID=${ID},IsActiveEntity=true)/draftEdit`, {});

    expect(draftItemResponse.status).toBe(201);

    expect(draftItemResponse.data).toMatchObject({
      HasActiveEntity: true,
      HasDraftEntity: false,
      IsActiveEntity: false,
      ID
    });

    draftItemResponse = await client.patch(`/fiori/Forms(ID=${ID},IsActiveEntity=false)`, {
      f1: "value f1 updated",
      f2: "value f2",
      f3: 128,
      f4: 99.99,
    });
    expect(draftItemResponse.status).toBe(200);

    draftItemResponse = await client.post(`/fiori/Forms(ID=${ID},IsActiveEntity=false)/draftActivate`);
    expect(draftItemResponse.status).toBe(200);


  });

});