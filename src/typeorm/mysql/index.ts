/* eslint-disable max-len */
// @ts-nocheck
import {
  Connection,
  ConnectionOptions
} from "typeorm";
import { CDSMySQLDriver } from "./driver";

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

export { CDSMySQLQueryRunner } from "./query-runner";
export { CDSMySQLSchemaBuilder } from "./schema-builder";
export { CDSMySQLDriver };


