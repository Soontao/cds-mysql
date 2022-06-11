import { cwdRequireCDS } from "cds-internal-tool";
import { csnToEntity } from "../src/typeorm";

describe("TypeORM Annotation Test Suite", () => {

  it("should support index for model", async () => {
    const cds = cwdRequireCDS();
    const csn = cds.parse.cdl(`
      @cds.typeorm.config : {indices : [{
        name    : 'NameIndex', // key name
        columns : ['Name'] // index fields
      }]}
      entity Demo {
        key ID: Integer;
            Name: String(255);
      }
    `);
    const entities =  csnToEntity(csn);
    expect(entities).toMatchObject([
      {
        options: {
          indices: [
            {
              name: "NameIndex",
              columns: [
                "Name",
              ],
            },
          ],
          name: "Demo",
          columns: {
            ID: {
              name: "ID",
              type: "integer",
              nullable: false,
              default: undefined,
              primary: true,
            },
            Name: {
              name: "Name",
              type: "nvarchar",
              nullable: true,
              default: null,
              length: 255,
            },
          },
          synchronize: true,
          deps: [
          ],
          tableName: "Demo",
        },
      },
    ]);
  });

});
