import { adaptToMySQLDateTime } from "../src/conversion-pre";


describe("Conversion Test Suite", () => {


  it("should support convert datetime for mysql", () => {
    expect(adaptToMySQLDateTime("0000-01-01T00:00:00.000Z")).toMatchSnapshot();
    expect(adaptToMySQLDateTime("9999-12-31T23:59:59.999Z")).toMatchSnapshot();
    expect(adaptToMySQLDateTime("9999-12-31T23:59:59Z")).toMatchSnapshot();
  });

});