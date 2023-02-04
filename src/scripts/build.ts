// @ts-nocheck
import { cwdRequireCDS } from "cds-internal-tool";
import { existsSync } from "fs";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { Query } from "typeorm/driver/Query";
import { csnToEntity } from "../typeorm/entity";
import { sha256 } from "../typeorm/migrate";
import { build_migration_scripts_from_entities } from "../typeorm/transparent";
import { Migration, MigrationHistory } from "../types";
import { migration_tool as migrationScript } from "../utils";

/**
 * initial version of migration script
 */
const INITIAL_VERSION = 100;

export async function build() {
  const cds = cwdRequireCDS();
  const logger = cds.log("build|cds|deploy");

  if (cds.env.requires.db?.tenant?.deploy?.transparent !== true) {
    logger.error("must enable transport deployment for 'cds-mysql'");
    return;
  }
  const base = path.join(cds.root, "db");
  const mysql_last_dev_file_path = path.join(base, "last-dev", "mysql.json");
  const mysql_migration_file_path = path.join(base, "migrations.sql");
  await mkdir(path.dirname(mysql_last_dev_file_path), { recursive: true });

  const current_entities = csnToEntity(await cds.load("*", { root: cds.root }));
  const current_hash = sha256(current_entities);
  const statements: Array<Query> = [];
  const migrations: Array<Migration> = [];
  let nextVersion = INITIAL_VERSION;
  let previous_entities = undefined;

  // last-dev json is existed
  if (existsSync(mysql_last_dev_file_path)) {
    // write migration scripts
    const last: MigrationHistory = JSON.parse(await readFile(mysql_last_dev_file_path, { encoding: "utf-8" }));
    nextVersion = last.version + 1;

    if (last.hash === current_hash) {
      logger.info("There is no model change");
      return;
    }

    previous_entities = last.entities;
  }

  // migrations.sql is existed
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

  const queries = await build_migration_scripts_from_entities(current_entities, previous_entities);

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
    mysql_last_dev_file_path,
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

  logger.info("Written last dev json", mysql_last_dev_file_path);
}
