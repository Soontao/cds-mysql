// @ts-nocheck
import { checkCdsVersion } from "../src/utils";
import { VERSION } from "../src/cds.version";

const mockCds = { version: VERSION.substring(1) };
jest.mock("cds-internal-tool", () => ({
  ...jest.requireActual("cds-internal-tool"),
  cwdRequireCDS: () => mockCds,
}));

describe("Utils Test Suite", () => {

  it("should do nothing if version is correct", () => {
    checkCdsVersion();
  });

  it("should raise error when version is not match", () => {
    mockCds.version = "5.9.8";
    expect(() => checkCdsVersion()).toThrowError();
  });

});