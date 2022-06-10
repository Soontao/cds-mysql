import { doAfterAll, doBeforeEach } from "./utils";
import { setupTest } from "cds-internal-tool";


describe("CSV App Test Suite", () => {

  const client = setupTest(__dirname, "./resources/csv-app");

  beforeEach(doBeforeEach);

  afterAll(doAfterAll);

  it("should support automatically migrate csv data", async () => {
    const response = await client.get("/app/$metadata");
    expect(response.status).toBe(200);
    expect(response.data).toMatch(/Peoples/);

    const p1r = await client.get("/app/Peoples(1)");
    expect(p1r.status).toBe(200);
    expect(p1r.data.Name).toBe("Theo 1");
    const t1r = await client.get("/app/TypeEntity(1)");
    expect(t1r.data).toEqual(
      {
        "@odata.context": "$metadata#TypeEntity/$entity",
        ID: 1,
        Name: "Theo 1",
        Age: 19,
        IDCard: 99132132,
        Weight: 123,
        Height: 177.22,
        Active: true,
        BirthDay: "1995-11-11",
        Sign: "2022-06-10T20:35:10Z",
        SignTime: "20:35:10",
        SignTmp: "2022-06-10T20:35:10.000Z",
        GlobalUUID: "0da69f3e-3e49-46c6-9eee-3e7e62ddb15d",
        BlobDoc: "SGVsbG8gQ0RTIEJpbmFyeQ==",
      }
    );
    const values = await cds.run(SELECT.one.from("test.resources.csv.app.srv.AppService.TypeEntity", 1));

    expect(values).toEqual(
      {
        ID: "1",
        Name: "Theo 1",
        Age: 19,
        IDCard: "99132132",
        Weight: "123",
        Height: 177.22,
        Active: true,
        BirthDay: "1995-11-11",
        Sign: "2022-06-10T20:35:10Z",
        SignTime: "20:35:10",
        SignTmp: "2022-06-10T20:35:10.000Z",
        GlobalUUID: "0da69f3e-3e49-46c6-9eee-3e7e62ddb15d",
        BlobDoc: Buffer.from("Hello CDS Binary", "utf-8"),
      }
    );
  });


});
