import { cwdRequireCDS } from "cds-internal-tool";
import "colors";
import { DataSourceOptions } from "typeorm";
import { SqlInMemory } from "typeorm/driver/SqlInMemory";
import { TypeORMLogger } from "./logger";
import { CDSMySQLDataSource } from "./mysql";
import { CDSMysqlRuntimeSupportEntity } from "./support";


export async function migrate(connectionOptions: DataSourceOptions, dryRun: true): Promise<SqlInMemory>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun?: false): Promise<void>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun = false): Promise<any> {
  const logger = cwdRequireCDS().log("mysql|db|migrate|typeorm");
  // TODO: lock for migration
  const ds = new CDSMySQLDataSource({
    ...connectionOptions,
    entities: [...(connectionOptions?.entities as [] ?? []), CDSMysqlRuntimeSupportEntity],
    logging: true,
    logger: TypeORMLogger,
  });

  try {
    await ds.initialize();
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