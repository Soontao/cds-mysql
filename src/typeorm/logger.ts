/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-nocheck
import { cwdRequireCDS } from "cds-internal-tool";
import type { QueryRunner } from "typeorm";


export const TypeORMLogger = {
  get logger() {
    const cds = cwdRequireCDS();
    return cds.log("typeorm");
  },
  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    TypeORMLogger.logger?.debug?.({ type: "query", query, parameters });
  },

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    TypeORMLogger.logger?.error?.({ type: "query_failed", error, query, parameters });
  },

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    TypeORMLogger.logger?.warn?.({ type: "slow_query", time, query, parameters });
  },

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    TypeORMLogger.logger?.debug?.({ type: "schema_build", message });
  },

  logMigration(message: string, queryRunner?: QueryRunner) {
    TypeORMLogger.logger?.debug?.({ type: "migration", message });
  },

  log(level: "log" | "info" | "warn", message: any, queryRunner?: QueryRunner) {
    TypeORMLogger.logger?.[level]?.({ message });
  },
};
