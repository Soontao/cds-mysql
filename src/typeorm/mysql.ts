import { defaultTo } from "@newdash/newdash";
import { Connection, ConnectionOptions, ReplicationMode, Table, TableColumn } from "typeorm";
import { MysqlDriver } from "typeorm/driver/mysql/MysqlDriver";
import { MysqlQueryRunner } from "typeorm/driver/mysql/MysqlQueryRunner";
import { Query } from "typeorm/driver/Query";
import { ColumnMetadata } from "typeorm/metadata/ColumnMetadata";
import { RdbmsSchemaBuilder } from "typeorm/schema-builder/RdbmsSchemaBuilder";
import { DateUtils } from "typeorm/util/DateUtils";
import { OrmUtils } from "typeorm/util/OrmUtils";
import { MYSQL_CHARSET, MYSQL_COLLATE } from "../constants";



/**
 * @internal
 */
export class CDSMySQLConnection extends Connection {
  constructor(options: ConnectionOptions) {
    super(options);
    // @ts-ignore
    this.driver = new CDSMySQLDriver(this);
  }
}

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

  /**
   * Differentiate columns of this table and columns from the given column metadatas columns
   * and returns only changed.
   */
  findChangedColumns(tableColumns: TableColumn[], columnMetadataList: ColumnMetadata[]): ColumnMetadata[] {
    return columnMetadataList.filter(columnMetadata => {
      const tableColumn = tableColumns.find(c => c.name === columnMetadata.databaseName);
      if (!tableColumn)
        return false; // we don't need new columns, we only need exist and changed

      let columnMetadataLength = columnMetadata.length;
      if (!columnMetadataLength && columnMetadata.generationStrategy === "uuid") { // fixing #3374
        columnMetadataLength = this.getColumnLength(columnMetadata);
      }

      if (tableColumn.name !== columnMetadata.databaseName) {
        return true;
      }
      if (tableColumn.type !== this.normalizeType(columnMetadata)) {
        return true;
      }
      if (tableColumn.length !== columnMetadataLength) {
        return true;
      }
      if (tableColumn.width !== columnMetadata.width) {
        return true;
      }
      if (columnMetadata.precision !== undefined && tableColumn.precision !== columnMetadata.precision) {
        return true;
      }
      if (columnMetadata.scale !== undefined && tableColumn.scale !== columnMetadata.scale) {
        return true;
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
      if (!this.compareDefaultValues(this.normalizeDefault(columnMetadata), tableColumn.default)) {
        return true;
      }
      if (
        tableColumn.enum &&
        columnMetadata.enum &&
        !OrmUtils.isArraysEqual(tableColumn.enum, columnMetadata.enum.map(val => val + ""))
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
    } else if (
      (columnMetadata.type === "enum"
        || columnMetadata.type === "simple-enum"
        || typeof defaultValue === "string")
      && defaultValue !== undefined) {
      return `'${defaultValue}'`;

    } else if ((columnMetadata.type === "set") && defaultValue !== undefined) {
      return `'${DateUtils.simpleArrayToString(defaultValue)}'`;

    } else if (typeof defaultValue === "number") {
      return `'${defaultValue.toFixed(columnMetadata.scale)}'`;

    } else if (typeof defaultValue === "boolean") {
      return defaultValue === true ? "1" : "0";

    } else if (typeof defaultValue === "function") {
      return defaultValue();

    } else {
      return defaultValue;
    }
  }

}




/**
 * @internal
 */
export class CDSMySQLQueryRunner extends MysqlQueryRunner {

  /**
   * Builds create table sql
   */
  protected createTableSql(table: Table, createForeignKeys?: boolean): Query {
    // enhance charset
    let sql = super.createTableSql(table, createForeignKeys).query;
    sql += ` CHARACTER SET '${MYSQL_CHARSET}' COLLATE '${MYSQL_COLLATE}'`;
    return new Query(sql);
  }

}



/**
 * @internal
 */
export class CDSMySQLSchemaBuilder extends RdbmsSchemaBuilder {

  /**
   * @override disable drop old columns
   */
  protected async executeSchemaSyncOperationsInProperOrder(): Promise<void> {
    await this.dropOldViews();
    // await this.dropOldForeignKeys();
    await this.dropOldIndices();
    await this.dropOldChecks();
    // await this.dropOldExclusions();
    // await this.dropCompositeUniqueConstraints();
    await this.renameColumns();
    await this.createNewTables();
    // DO NOT drop old columns
    // await this.dropRemovedColumns(); 
    await this.addNewColumns();
    await this.updatePrimaryKeys();
    await this.updateExistColumns();
    await this.createNewIndices();
    await this.createNewChecks();
    // await this.createNewExclusions();
    // await this.createCompositeUniqueConstraints();
    // await this.createForeignKeys();
    await this.createViews();
  }

}
