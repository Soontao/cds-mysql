/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
import cds from "@sap/cds";
import { Logger, QueryRunner } from "typeorm";

const logger = cds.log("mysql|db");

export class TypeORMLogger implements Logger {
  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    logger?.debug?.({ type: "query", query, parameters });
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    logger?.error?.({ type: "query_failed", error, query, parameters });
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    logger?.warn?.({ type: "slow_query", time, query, parameters });
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    logger?.debug?.({ type: "schema_build", message });
  }

  logMigration(message: string, queryRunner?: QueryRunner) {
    logger?.debug?.({ type: "migration", message });
  }

  log(level: "log" | "info" | "warn", message: any, queryRunner?: QueryRunner) {
    logger?.[level]?.({ message });
  }
}
