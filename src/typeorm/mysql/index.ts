/* eslint-disable max-len */
// @ts-nocheck
import { DataSource, DataSourceOptions } from "typeorm";
import { CDSMySQLDriver } from "./driver";

/**
 * MySQL datasource for cds-mysql
 * 
 * @internal
 */
export class CDSMySQLDataSource extends DataSource {
  constructor(options: DataSourceOptions) {
    super(options);
    this.driver = new CDSMySQLDriver(this);
  }

  /**
   * create datasource with driver type detection 
   * 
   * @param options 
   * @returns 
   */
  public static async createDataSource(options: DataSourceOptions) {
    const ds = new CDSMySQLDataSource(options);
    await ds.initialize();
    if (ds.options.type === "mysql") {
      if (await ds.isMariaDb()) {
        // cds-mysql: fix mariadb driver, the options.type will be used for metadata processing
        await ds.destroy();
        const mariadb = new CDSMySQLDataSource({ ...options, type: "mariadb" });
        await mariadb.initialize();
        return mariadb;
      }
    }
    return ds;
  }

  /**
   * check the current database is mariadb or not
   * 
   * @returns 
   */
  public async isMariaDb(): Promise<boolean> {
    const [{ IS_MARIA_DB }] = await this.query(`SELECT LOWER(VERSION()) LIKE '%mariadb%' as IS_MARIA_DB`);
    return IS_MARIA_DB === 1;
  }
}

export { CDSMySQLQueryRunner } from "./query-runner";
export { CDSMySQLSchemaBuilder } from "./schema-builder";
export { CDSMySQLDriver };


