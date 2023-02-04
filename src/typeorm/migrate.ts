/* eslint-disable max-len */
import { cwdRequireCDS } from "cds-internal-tool";
import "colors";
import { DataSourceOptions, EntitySchema } from "typeorm";
import { SqlInMemory } from "typeorm/driver/SqlInMemory";
import { TypeORMLogger } from "./logger";
import { createHash } from "crypto";
import { CDSMySQLDataSource } from "./mysql";
import { last6Chars } from "../utils";
import { Migration } from "../types";


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

async function migrateMetadata(connectionOptions: DataSourceOptions): Promise<void> {
  const ds = new CDSMySQLDataSource({
    ...connectionOptions,
    entities: CDSMysqlMetaTables,
    logging: true,
    logger: TypeORMLogger,
  });
  await ds.initialize();
  const builder = ds.driver.createSchemaBuilder();
  return await builder.build();
}


export async function migrate(connectionOptions: DataSourceOptions, dryRun: true): Promise<SqlInMemory>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun: false, migrations: Array<Migration>): Promise<void>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun?: false): Promise<void>;
export async function migrate(connectionOptions: DataSourceOptions, dryRun = false, migrations?: Array<Migration>): Promise<any> {

  const logger = cwdRequireCDS().log("db|deploy|mysql|migrate|typeorm");

  logger.debug("start migrate meta tables for cds-mysql");
  await migrateMetadata(connectionOptions);
  logger.debug("migrate meta tables for cds-mysql successful");

  if (connectionOptions.entities === undefined || connectionOptions.entities?.length === 0) {
    if (migrations === undefined) {
      logger.warn("there is no entities provided, skip processing");
      return;
    }
  }

  const ds = await CDSMySQLDataSource.createDataSource({
    ...connectionOptions,
    logging: true,
    logger: TypeORMLogger,
  });

  try {

    return await ds.transaction(async tx => {
      const [record] = await tx.query("SELECT ID, HASH, MIGRATED_AT FROM cds_mysql_migration_history ORDER BY MIGRATED_AT DESC LIMIT 1 FOR UPDATE");

      if (migrations !== undefined) {
        // transparent migration
        for (const m of migrations.filter(migration => migration.version > (record?.ID ?? Number.MIN_VALUE))) {
          logger.info("migrate version", m.version, "generated at", m.at, "to hash", last6Chars(m.hash).green);
          for (const ddl of m.statements) { await tx.query(ddl.query); }
          await tx.createQueryBuilder()
            .insert()
            .into(MigrationHistory)
            .values({ id: m.version, hash: m.hash })
            .execute();
        }
        return;
      }
      else {
        // traditional way
        const entityHash = sha256(connectionOptions.entities as any as Array<any>);

        logger.info(
          "migrate database", String(connectionOptions.database).green,
          "with hash", last6Chars(entityHash).green,
        );

        if (!dryRun) {
          if (record?.HASH === entityHash) {
            logger.debug(
              "database model with hash", last6Chars(entityHash).green,
              "was ALREADY migrated at", String(record.MIGRATED_AT).green,
            );
            return;
          }
          await tx.createQueryBuilder()
            .insert()
            .into(MigrationHistory)
            .values({ hash: entityHash })
            .execute();
        }

        const builder = ds.driver.createSchemaBuilder();
        // dry run and return the DDL SQL
        if (dryRun) { return await builder.log(); }
        // perform DDL
        return await builder.build();
      }
    });

  }
  catch (error) {
    logger.error("migrate database failed:", error);
    throw error;
  }
  finally {
    if (ds?.isInitialized) {
      await ds.destroy();
    }
  }
}
export { migrateData } from "./csv";
