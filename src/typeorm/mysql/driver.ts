/* eslint-disable max-len */
import { defaultTo } from "@newdash/newdash/defaultTo";
import { isEmpty } from "@newdash/newdash/isEmpty";
import type { ReplicationMode, TableColumn } from "typeorm";
import { MysqlDriver } from "typeorm/driver/mysql/MysqlDriver";
import { ColumnMetadata } from "typeorm/metadata/ColumnMetadata";
import { DateUtils } from "typeorm/util/DateUtils";
import { OrmUtils } from "typeorm/util/OrmUtils";
import { CDSMySQLQueryRunner } from "./query-runner";
import { CDSMySQLSchemaBuilder } from "./schema-builder";

/**
 * @internal
 */
export class CDSMySQLDriver extends MysqlDriver {
  /**
   * Creates a schema builder used to build and sync a schema.
   */
  createSchemaBuilder() {
    return new CDSMySQLSchemaBuilder(this.connection);
  }

  /**
   * Creates a query runner used to execute database queries.
   */
  createQueryRunner(mode: ReplicationMode) {
    return new CDSMySQLQueryRunner(this, mode);
  }

  normalizeType(column: ColumnMetadata) {
    if (column instanceof String) {
      return "nvarchar";
    }
    if (column.type === "uuid") {
      return "nvarchar";
    }
    if (column.type === "nvarchar" ||
      column.type === "national varchar") {
      return "nvarchar";
    }
    return super.normalizeType(column);
  }

  /**
   * Differentiate columns of this table and columns from the given column metadatas columns
   * and returns only changed.
   */
  findChangedColumns(tableColumns: TableColumn[], columnMetadataList: ColumnMetadata[]): ColumnMetadata[] {
    return columnMetadataList.filter((columnMetadata) => {
      const tableColumn = tableColumns.find((c) => c.name === columnMetadata.databaseName);
      if (!tableColumn) return false; // we don't need new columns, we only need exist and changed

      let columnMetadataLength = columnMetadata.length;
      if (!columnMetadataLength && columnMetadata.generationStrategy === "uuid") {
        // fixing #3374
        columnMetadataLength = this.getColumnLength(columnMetadata);
      }

      if (tableColumn.name !== columnMetadata.databaseName) {
        return true;
      }
      if (tableColumn.type !== this.normalizeType(columnMetadata)) {
        return true;
      }
      if (this.withLengthColumnTypes.includes(tableColumn.type as any)) {
        // for the empty length, it means its maybe a default length
        if (
          !isEmpty(tableColumn.length)
          && !isEmpty(columnMetadataLength)
          && tableColumn.length !== columnMetadataLength) {
          return true;
        }
      }

      if (this.withWidthColumnTypes.includes(tableColumn.type as any)) {
        if (tableColumn.width !== columnMetadata.width) {
          return true;
        }
      }

      if (this.withPrecisionColumnTypes.includes(tableColumn.type as any)) {
        if (columnMetadata.precision !== undefined && tableColumn.precision !== columnMetadata.precision) {
          return true;
        }
      }

      if (this.withScaleColumnTypes.includes(tableColumn.type as any)) {
        if (columnMetadata.scale !== undefined && tableColumn.scale !== columnMetadata.scale) {
          return true;
        }
      }

      if (tableColumn.zerofill !== columnMetadata.zerofill) {
        return true;
      }
      if (tableColumn.unsigned !== columnMetadata.unsigned) {
        return true;
      }
      if (tableColumn.asExpression !== columnMetadata.asExpression) {
        return true;
      }
      if (tableColumn.generatedType !== columnMetadata.generatedType) {
        return true;
      }
      if (defaultTo(tableColumn.comment, "") !== defaultTo(columnMetadata.comment, "")) {
        return true;
      }
      if (
        !this.compareDefaultValues(
          this.normalizeDefault(columnMetadata),
          tableColumn.default === "'NULL'" ? undefined : tableColumn.default
        )
      ) {
        return true;
      }
      if (
        tableColumn.enum &&
        columnMetadata.enum &&
        !OrmUtils.isArraysEqual(
          tableColumn.enum,
          columnMetadata.enum.map((val) => val + "")
        )
      ) {
        return true;
      }
      if (tableColumn.onUpdate !== columnMetadata.onUpdate) {
        return true;
      }
      if (tableColumn.isPrimary !== columnMetadata.isPrimary) {
        return true;
      }
      if (tableColumn.isNullable !== columnMetadata.isNullable) {
        return true;
      }
      if (tableColumn.isUnique !== this.normalizeIsUnique(columnMetadata)) {
        return true;
      }
      if (columnMetadata.generationStrategy !== "uuid" && tableColumn.isGenerated !== columnMetadata.isGenerated) {
        return true;
      }

      return false;
    });
  }

  /**
   * Normalizes "default" value of the column.
   */
  normalizeDefault(columnMetadata: ColumnMetadata): string | undefined {
    const defaultValue = columnMetadata.default;

    if (defaultValue === null) {
      return undefined;
    } else if (defaultValue === "'NULL'") {
      return undefined;
    } else if (
      (columnMetadata.type === "enum" || columnMetadata.type === "simple-enum" || typeof defaultValue === "string") &&
      defaultValue !== undefined
    ) {
      return `'${defaultValue}'`;
    } else if (columnMetadata.type === "set" && defaultValue !== undefined) {
      return `'${DateUtils.simpleArrayToString(defaultValue)}'`;
    } else if (typeof defaultValue === "number") {
      return `'${defaultValue.toFixed(columnMetadata.scale)}'`;
    } else if (typeof defaultValue === "boolean") {
      return defaultValue === true ? "1" : "0";
    } else if (typeof defaultValue === "function") {
      return defaultValue();
    } else {
      return defaultValue as any;
    }
  }
}
