import { DataSourceOptions } from "typeorm";
import { SqlInMemory } from "typeorm/driver/SqlInMemory";
import { TypeORMLogger } from "./logger";
import { CDSMySQLDataSource } from "./mysql";

export async function migrate(connectionOptions: DataSourceOptions, dryRun: true): Promise<SqlInMemory>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun?: false): Promise<void>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun = false): Promise<any> {
  // TODO: lock for migration
  const ds = new CDSMySQLDataSource({
    ...connectionOptions,
    logging: true,
    logger: new TypeORMLogger()
  });

  try {
    await ds.initialize();
    const builder = ds.driver.createSchemaBuilder();
    // dry run and return the DDL SQL
    if (dryRun) {
      return await builder.log();
    }
    await builder.build(); // execute build
  } catch (error) {
    throw error;
  } finally {
    if (ds.isInitialized) {
      await ds.destroy();
    }
  }
}
