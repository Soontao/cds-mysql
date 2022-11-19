/* eslint-disable max-len */
import { sleep } from "@newdash/newdash";
import { cwdRequireCDS } from "cds-internal-tool";
import "colors";
import { DataSourceOptions } from "typeorm";
import { SqlInMemory } from "typeorm/driver/SqlInMemory";
import { TypeORMLogger } from "./logger";
import { CDSMySQLDataSource } from "./mysql";

const DEFAULT_MIGRATION_CHECK_INTERVAL_SEC = 5;

export async function migrate(connectionOptions: DataSourceOptions, dryRun: true): Promise<SqlInMemory>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun?: false): Promise<void>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun = false): Promise<any> {
  const logger = cwdRequireCDS().log("mysql|db|migrate|typeorm");
  const ds = new CDSMySQLDataSource({
    ...connectionOptions,
    entities: connectionOptions?.entities ?? [],
    logging: true,
    logger: TypeORMLogger,
  });

  try {
    await ds.initialize();
    for (; ;) {
      // use process list to find other connections
      // soft lock for migration
      const [{ COUNT }] = await ds.query(`SELECT count(1) as COUNT FROM INFORMATION_SCHEMA.PROCESSLIST where ID != connection_id() and USER != user() and COMMAND = 'Query'`);
      if (COUNT === 0 || COUNT === "0") {
        break;
      }
      else {
        logger.info(
          "there are",
          COUNT,
          "queries running, wait for",
          DEFAULT_MIGRATION_CHECK_INTERVAL_SEC,
          "seconds, then retry migration"
        );
        await sleep(DEFAULT_MIGRATION_CHECK_INTERVAL_SEC * 1000);
      }
    }
    const builder = ds.driver.createSchemaBuilder();
    // dry run and return the DDL SQL
    if (dryRun) {
      return await builder.log();
    }
    await builder.build(); // execute build
  }
  catch (error) {
    logger.error("migrate database failed:", error);
    throw error;
  }
  finally {
    if (ds.isInitialized) {
      await ds.destroy();
    }
  }
}
export { migrateData } from "./csv";
