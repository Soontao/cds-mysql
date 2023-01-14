/* eslint-disable max-len */
import { cwdRequireCDS } from "cds-internal-tool";
import "colors";
import { DataSourceOptions, EntitySchema } from "typeorm";
import { SqlInMemory } from "typeorm/driver/SqlInMemory";
import { TypeORMLogger } from "./logger";
import { createHash } from "crypto";
import { CDSMySQLDataSource } from "./mysql";


const MigrationHistory = new EntitySchema({
  name: "cds_mysql_migration_history",
  tableName: "cds_mysql_migration_history",
  columns: {
    id: {
      primary: true,
      type: "bigint",
      generated: "increment",
    },
    hash: {
      name: "HASH",
      type: "varchar",
      length: 64,
      nullable: false,
    },
    migratedAt: {
      name: "MIGRATED_AT",
      type: "datetime",
      createDate: true,
    },
  }
});

const CSVMigrationHistory = new EntitySchema({
  name: "cds_mysql_csv_history",
  tableName: "cds_mysql_csv_history",
  columns: {
    entity: {
      name: "ENTITY",
      type: "varchar",
      length: 64,
      primary: true,
    },
    hash: {
      name: "HASH",
      type: "varchar",
      length: 64,
      nullable: false,
    },
  }
});

const CDSMysqlMetaTables = [MigrationHistory, CSVMigrationHistory];

/**
 * sha256 for entities
 * 
 * @param entities 
 * @returns 
 */
export function sha256(entities: Array<EntitySchema>) {
  const hash = createHash("sha256");
  for (const entity of entities) {
    hash.update(JSON.stringify(entity));
  }
  return hash.digest("hex");
}


export async function migrate(connectionOptions: DataSourceOptions, dryRun: true): Promise<SqlInMemory>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun?: false): Promise<void>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun = false): Promise<any> {

  const isMetaMigration = connectionOptions.entities === CDSMysqlMetaTables;
  const isTenantMigration = dryRun === false && !isMetaMigration;

  const logger = cwdRequireCDS().log("mysql|db|migrate|typeorm");

  const entityHash = sha256(connectionOptions.entities as any as Array<any>);

  if (isTenantMigration) {
    logger.debug("start migrate meta tables for cds-mysql");
    await migrate({ ...connectionOptions, entities: CDSMysqlMetaTables }, false);
    logger.debug("migrate meta tables for cds-mysql successful");
  }

  if (connectionOptions.entities === undefined || connectionOptions.entities?.length === 0) {
    logger.warn("there is no entities provided, skip processing");
  }

  const ds = new CDSMySQLDataSource({
    ...connectionOptions,
    entities: connectionOptions.entities,
    logging: true,
    logger: TypeORMLogger,
  });

  try {
    (isTenantMigration ? logger.info : logger.debug)(
      "migrate database",
      String(connectionOptions.database).green,
      "with hash",
      entityHash.slice(entityHash.length - 6).green
    );

    await ds.initialize();

    // not dry run and not meta table migration
    if (isTenantMigration) {
      const [record] = await ds.query("SELECT HASH, MIGRATED_AT FROM cds_mysql_migration_history ORDER BY MIGRATED_AT DESC LIMIT 1 FOR UPDATE");
      if (record?.HASH === entityHash) {
        logger.info(
          "database with hash",
          entityHash.slice(entityHash.length - 6).green,
          "was ALREADY migrated at", String(record.MIGRATED_AT).green,
        );
        return;
      }
      await ds.createQueryBuilder()
        .insert()
        .into(MigrationHistory)
        .values({ hash: entityHash })
        .execute();
    }

    const builder = ds.driver.createSchemaBuilder();

    // dry run and return the DDL SQL
    if (dryRun) { return await builder.log(); }
    // perform DDL
    await builder.build();
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
