/* eslint-disable max-len */
// @ts-nocheck
import {
  DataSource,
  DataSourceOptions
} from "typeorm";
import { CDSMySQLDriver } from "./driver";

/**
 * @internal
 */
export class CDSMySQLDataSource extends DataSource {
  constructor(options: DataSourceOptions) {
    super(options);
    // @ts-ignore
    this.driver = new CDSMySQLDriver(this);
  }
}

export { CDSMySQLQueryRunner } from "./query-runner";
export { CDSMySQLSchemaBuilder } from "./schema-builder";
export { CDSMySQLDriver };


