// @ts-nocheck
import { CSN, cwdRequireCDS } from "cds-internal-tool";
import { EntitySchema, Table } from "typeorm";
import { View } from "typeorm/schema-builder/view/View";
import { entitySchemaToTable } from "./database";
import { csnToEntity } from "./entity";
import { CDSMySQLDataSource } from "./mysql";

/**
 * build DDL statements 
 * 
 * @param current 
 * @param previous 
 * @returns 
 */
export async function build_migration_scripts_from_csn(current: CSN, previous?: CSN) {
  return build_migration_scripts_from_entities(
    csnToEntity(current),
    previous === undefined ? undefined : csnToEntity(previous)
  );
}


/**
 * build DDL statements 
 * 
 * carefully, many hack in this function
 * 
 * @ignore
 * @internal
 * @private
 * @param current_entities 
 * @param previous_entities
 * @returns 
 */
export async function build_migration_scripts_from_entities(
  current_entities: Array<EntitySchema>,
  previous_entities?: Array<EntitySchema>,
) {
  const cds = cwdRequireCDS();
  const last_version_tables: Array<Table> = [];
  const last_version_views: Array<View> = [];

  if (previous_entities instanceof Array) {
    last_version_views.push(
      ...previous_entities
        .filter(e => e.options.type === "view")
        .map(entitySchemaToTable) as any
    );
    last_version_tables.push(
      ...previous_entities
        .filter(e => e.options.type !== "view")
        .map(entitySchemaToTable) as any
    );
  }

  const ds = new CDSMySQLDataSource({
    name: `ds-internal-virtual-migration-${cds.utils.uuid()}`,
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
  return queryRunner.getMemorySql().upQueries.filter(query => query !== undefined);;
}
