/* eslint-disable max-len */
// @ts-nocheck
import { DataSource, DataSourceOptions } from "typeorm";
import { CDSMySQLDriver } from "./driver";

/**
 * @internal
 */
export class CDSMySQLDataSource extends DataSource {
  constructor(options: DataSourceOptions) {
    super(options);
    this.driver = new CDSMySQLDriver(this);
  }

  public static async createDataSource(options: DataSourceOptions) {
    const ds = new CDSMySQLDataSource(options);
    await ds.initialize();
    if (ds.options.type === "mysql") {
      if (await ds.isMariaDb()) {
        // cds-mysql: fix mariadb driver
        await ds.destroy();
        const mariadb = new CDSMySQLDataSource({ ...options, type: "mariadb" });
        await mariadb.initialize();
        return mariadb;
      }
    }
    return ds;
  }

  public async isMariaDb(): Promise<boolean> {
    const [{ IS_MARIA_DB }] = await this.query(`SELECT LOWER(VERSION()) LIKE '%mariadb%' as IS_MARIA_DB`);
    return IS_MARIA_DB === 1;
  }
}

export { CDSMySQLQueryRunner } from "./query-runner";
export { CDSMySQLSchemaBuilder } from "./schema-builder";
export { CDSMySQLDriver };


