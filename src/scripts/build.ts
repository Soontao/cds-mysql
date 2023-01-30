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


interface Migration {
  version: number;
  up_queries: Array<Query>;
}

interface MigrationHistory {
  version: number;
  entities: Array<EntitySchema>;
  hash: string;
  migrations: Array<Migration>;
}

export async function build() {
  const cds = cwdRequireCDS();
  const logger = cds.log("build|cds|deploy");
  const base = path.join(cds.root, "db/last-dev");
  await mkdir(base, { recursive: true });
  const mysql_last_file_path = path.join(base, "mysql.json");
  const current_entities = csnToEntity(await cds.load("*", { root: cds.root }));
  const current_hash = sha256(current_entities);
  const up_queries: Array<Query> = [];
  const migrations: Array<Migration> = [];
  let nextVersion = 100;

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

    migrations.push(
      ...last.migrations
    );

  }

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

  const builder = ds.driver.createSchemaBuilder();
  builder.queryRunner = queryRunner;
  await builder.executeSchemaSyncOperationsInProperOrder();
  up_queries.push(...queryRunner.getMemorySql().upQueries);

  migrations.push({
    version: nextVersion,
    up_queries
  });

  await writeFile(
    mysql_last_file_path,
    JSON.stringify(
      {
        version: nextVersion,
        entities: current_entities,
        hash: current_hash,
        migrations,
      },
      null,
      2
    ),
    { encoding: "utf-8" }
  );

  logger.info("Write last dev json for cds-mysql to", mysql_last_file_path);
}