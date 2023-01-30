import { EntitySchema } from "typeorm";
import { View } from "typeorm/schema-builder/view/View";
import { TableColumn } from "typeorm/schema-builder/table/TableColumn";
import { Table } from "typeorm/schema-builder/table/Table";
import { CDSMySQLDriver } from "./mysql";

/**
 * convert entity to raw table information
 * 
 * @param entity 
 * @returns 
 */
export function entitySchemaToTable(entity: EntitySchema) {
  const { options } = entity;
  switch (options.type) {
    case "view":
      return new View({
        name: options.tableName ?? options.name,
        expression: options.expression,
      });
    default:
      return new Table({
        name: options.tableName ?? options.name,
        columns: Object.entries(options?.columns ?? {}).map(([name, column]) => new TableColumn({
          name,
          isPrimary: column.primary,
          type: CDSMySQLDriver.prototype.normalizeType(column as any),
          isUnique: column.unique, // REVISIT: normalizeUnique ?
          unsigned: column.unsigned,
          length: column.length === undefined ? undefined : String(column.length),
          scale: column.scale,
          precision: column.precision,
          default: CDSMySQLDriver.prototype.normalizeDefault(column as any),
          isNullable: column.nullable,
          isGenerated: Boolean(column.generated),
          comment: column.comment,
        })),
        indices: Object.entries(options?.indices ?? {}).map(([name, indice]) => ({
          name,
          columnNames: indice.columns as Array<string>,
        }))
      });
  }
}