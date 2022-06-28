import { EntitySchema } from "typeorm";


export const CDSMysqlCSVMigrateEntity: EntitySchema = new EntitySchema({
  name: "cds_mysql_csv_history",
  tableName: "cds_mysql_csv_history",
  columns: {
    id: { type: "integer", primary: true, generated: "increment", comment: "dummy id" },
    entity: { type: "nvarchar", length: 500, comment: "entity name" },
    hash: { type: "nvarchar", length: 64, comment: "sha256 hash" },
  },
});

export const supportEntities = [
  CDSMysqlCSVMigrateEntity,
];