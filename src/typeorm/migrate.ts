import { ConnectionOptions } from "typeorm";
import { SqlInMemory } from "typeorm/driver/SqlInMemory";
import { TypeORMLogger } from "./logger";
import { CDSMySQLConnection } from "./mysql";

export async function migrate(connectionOptions: ConnectionOptions, dryRun: true): Promise<SqlInMemory>;
export async function migrate(connectionOptions: ConnectionOptions, dryRun?: false): Promise<void>;
export async function migrate(connectionOptions: ConnectionOptions, dryRun = false): Promise<any> {
  const conn = new CDSMySQLConnection({
    ...connectionOptions,
    logging: true,
    logger: new TypeORMLogger()
  });

  try {
    await conn.connect();
    const builder = conn.driver.createSchemaBuilder();
    // dry run and return the DDL SQL
    if (dryRun) {
      return await builder.log();
    }
    await builder.build(); // execute build
  } catch (error) {
    throw error;
  } finally {
    if (conn.isConnected) {
      await conn.close();
    }
  }
}
