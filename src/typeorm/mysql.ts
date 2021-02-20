import { Connection, ConnectionOptions, ReplicationMode, Table, TableIndex } from "typeorm";
import { MysqlDriver } from "typeorm/driver/mysql/MysqlDriver";
import { MysqlQueryRunner } from "typeorm/driver/mysql/MysqlQueryRunner";
import { Query } from "typeorm/driver/Query";
import { RdbmsSchemaBuilder } from "typeorm/schema-builder/RdbmsSchemaBuilder";
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

}


/**
 * @internal
 */
export class CDSMySQLQueryRunner extends MysqlQueryRunner {


  /**
   * Builds create table sql
   */
  protected createTableSql(table: Table, createForeignKeys?: boolean): Query {
    const columnDefinitions = table.columns.map(column => this.buildCreateColumnSql(column, true)).join(", ");
    let sql = `CREATE TABLE ${this.escapePath(table)} (${columnDefinitions}`;

    // we create unique indexes instead of unique constraints, because MySql does not have unique constraints.
    // if we mark column as Unique, it means that we create UNIQUE INDEX.
    table.columns
      .filter(column => column.isUnique)
      .forEach(column => {
        const isUniqueIndexExist = table.indices.some(index => {
          return index.columnNames.length === 1 && !!index.isUnique && index.columnNames.indexOf(column.name) !== -1;
        });
        const isUniqueConstraintExist = table.uniques.some(unique => {
          return unique.columnNames.length === 1 && unique.columnNames.indexOf(column.name) !== -1;
        });
        if (!isUniqueIndexExist && !isUniqueConstraintExist)
          table.indices.push(new TableIndex({
            name: this.connection.namingStrategy.uniqueConstraintName(table.name, [column.name]),
            columnNames: [column.name],
            isUnique: true
          }));
      });

    // as MySql does not have unique constraints, we must create table indices from table uniques and mark them as unique.
    if (table.uniques.length > 0) {
      table.uniques.forEach(unique => {
        const uniqueExist = table.indices.some(index => index.name === unique.name);
        if (!uniqueExist) {
          table.indices.push(new TableIndex({
            name: unique.name,
            columnNames: unique.columnNames,
            isUnique: true
          }));
        }
      });
    }

    if (table.indices.length > 0) {
      const indicesSql = table.indices.map(index => {
        const columnNames = index.columnNames.map(columnName => `\`${columnName}\``).join(", ");
        if (!index.name)
          index.name = this.connection.namingStrategy.indexName(table.name, index.columnNames, index.where);

        let indexType = "";
        if (index.isUnique)
          indexType += "UNIQUE ";
        if (index.isSpatial)
          indexType += "SPATIAL ";
        if (index.isFulltext)
          indexType += "FULLTEXT ";
        const indexParser = index.isFulltext && index.parser ? ` WITH PARSER ${index.parser}` : "";

        return `${indexType}INDEX \`${index.name}\` (${columnNames})${indexParser}`;
      }).join(", ");

      sql += `, ${indicesSql}`;
    }

    if (table.foreignKeys.length > 0 && createForeignKeys) {
      const foreignKeysSql = table.foreignKeys.map(fk => {
        const columnNames = fk.columnNames.map(columnName => `\`${columnName}\``).join(", ");
        if (!fk.name)
          fk.name = this.connection.namingStrategy.foreignKeyName(table.name, fk.columnNames, fk.referencedTableName, fk.referencedColumnNames);
        const referencedColumnNames = fk.referencedColumnNames.map(columnName => `\`${columnName}\``).join(", ");

        let constraint = `CONSTRAINT \`${fk.name}\` FOREIGN KEY (${columnNames}) REFERENCES ${this.escapePath(fk.referencedTableName)} (${referencedColumnNames})`;
        if (fk.onDelete)
          constraint += ` ON DELETE ${fk.onDelete}`;
        if (fk.onUpdate)
          constraint += ` ON UPDATE ${fk.onUpdate}`;

        return constraint;
      }).join(", ");

      sql += `, ${foreignKeysSql}`;
    }

    if (table.primaryColumns.length > 0) {
      const columnNames = table.primaryColumns.map(column => `\`${column.name}\``).join(", ");
      sql += `, PRIMARY KEY (${columnNames})`;
    }

    sql += `) ENGINE=${table.engine || "InnoDB"}`;

    // enhance charset
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
