import { EntitySchema } from "typeorm";


export const CDSMysqlRuntimeSupportEntity: EntitySchema = new EntitySchema({
  name: "cds_mysql_runtime_support",
  tableName: "cds_mysql_runtime_support",
  columns: {
    key: { type: "nvarchar", length: 255, primary: true, comment: "key" },
    value: {
      type: "nvarchar",
      length: 4000,
      nullable: false,
      transformer: {
        from(value) { return JSON.parse(value); },
        to(value) { return JSON.stringify(value); },
      },
      comment: "value",
    },
  },
});

export const CDSMysqlCSVMigrateEntity: EntitySchema = new EntitySchema({
  name: "cds_mysql_csv_history",
  tableName: "cds_mysql_csv_history",
  columns: {
    entity: { type: "nvarchar", length: 500, primary: true, comment: "entity name" },
    hash: { type: "nvarchar", length: 64, comment: "sha256 hash" },
  },
});

export const supportEntities = [
  CDSMysqlCSVMigrateEntity,
  CDSMysqlRuntimeSupportEntity,
];