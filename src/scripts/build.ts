// @ts-nocheck
import { cwdRequireCDS } from "cds-internal-tool";
import { readFile, mkdir, writeFile } from "fs/promises";
import { EntitySchema, Table } from "typeorm";
import { existsSync } from "fs";
import path from "path";
import { csnToEntity } from "../typeorm/entity";
import { sha256 } from "../typeorm/migrate";
import { entitySchemaToTable } from "../typeorm/database";
import { View } from "typeorm/schema-builder/view/View";
import { CDSMySQLDataSource } from "../typeorm/mysql";
import { Query } from "typeorm/driver/Query";
import { MigrationHistory, Query, Migration } from "../types";
import { migration_tool as migrationScript } from "../utils";


const INITIAL_VERSION = 100;

export async function build() {
  const cds = cwdRequireCDS();
  const logger = cds.log("build|cds|deploy");

  if (cds.env.requires.db?.tenant?.deploy?.transparent !== true) {
    logger.error("must enable transport deployment for 'cds-mysql'");
    return;
  }
  const base = path.join(cds.root, "db");
  const mysql_last_file_path = path.join(base, "last-dev", "mysql.json");
  const mysql_migration_file_path = path.join(base, "migrations.sql");
  await mkdir(path.dirname(mysql_last_file_path), { recursive: true });

  const current_entities = csnToEntity(await cds.load("*", { root: cds.root }));
  const current_hash = sha256(current_entities);
  const statements: Array<Query> = [];
  const migrations: Array<Migration> = [];
  let nextVersion = INITIAL_VERSION;

  const last_version_views: Array<View> = [];
  const last_version_tables: Array<Table> = [];

  if (existsSync(mysql_last_file_path)) {
    // write migration scripts
    const last: MigrationHistory = JSON.parse(await readFile(mysql_last_file_path, { encoding: "utf-8" }));
    nextVersion = last.version + 1;

    if (last.hash === current_hash) {
      logger.info("There is no model change");
      return;
    }

    last_version_views.push(
      ...last.entities
        .filter(e => e.options.type === "view")
        .map(entitySchemaToTable) as any
    );

    last_version_tables.push(
      ...last.entities
        .filter(e => e.options.type !== "view")
        .map(entitySchemaToTable) as any
    );

  }

  if (existsSync(mysql_migration_file_path)) {
    const last: Array<Migration> = migrationScript.parse(
      await readFile(mysql_migration_file_path, { encoding: "utf-8" })
    );

    if (last.length > 0) {
      migrations.push(...last);
      nextVersion = last[last.length - 1].version + 1;
    }
  }

  // >> typeorm internal hack

  const queries = await build_migration_scripts(current_entities, last_version_tables, last_version_views);

  // << typeorm internal hack

  statements.push(...queries);

  migrations.push({ version: nextVersion, at: new Date(), statements: statements, hash: current_hash });

  await writeFile(
    mysql_migration_file_path,
    migrationScript.stringify(migrations),
    { encoding: "utf-8" }
  );

  logger.info("Written migrations.sql", mysql_migration_file_path);

  await writeFile(
    mysql_last_file_path,
    JSON.stringify(
      {
        version: nextVersion,
        entities: current_entities,
        hash: current_hash,
      },
      null,
      2
    ),
    { encoding: "utf-8" }
  );

  logger.info("Written last dev json", mysql_last_file_path);
}

/**
 * 
 * @ignore
 * @internal
 * @private
 * @param current_entities 
 * @param last_version_tables 
 * @param last_version_views 
 * @returns 
 */
export async function build_migration_scripts(
  current_entities: Array<EntitySchema>,
  last_version_tables: Table[],
  last_version_views: View[]
) {
  const ds = new CDSMySQLDataSource({
    type: "mysql",
    database: "__database_placeholder__",
    entities: current_entities,
  });

  await ds.buildMetadatas();
  const queryRunner = ds.createQueryRunner();
  queryRunner.loadedTables = last_version_tables;
  queryRunner.loadedViews = last_version_views;
  queryRunner.enableSqlMemory();
  queryRunner.getCurrentDatabase = function () { return ds.options.database; };
  queryRunner.getCurrentSchema = function () { return ds.options.database; };
  queryRunner.insertViewDefinitionSql = function () { return undefined; };
  queryRunner.deleteViewDefinitionSql = function () { return undefined; };

  const builder = ds.driver.createSchemaBuilder();
  builder.queryRunner = queryRunner;
  await builder.executeSchemaSyncOperationsInProperOrder();

  const queries = queryRunner.getMemorySql().upQueries.filter(query => query !== undefined);
  return queries;
}
