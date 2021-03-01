import { Connection, ConnectionOptions, ReplicationMode, Table } from "typeorm";
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
