// @ts-nocheck
import { RdbmsSchemaBuilder } from "typeorm/schema-builder/RdbmsSchemaBuilder";
import {
  Table
} from "typeorm/schema-builder/table/Table";
import { View } from "typeorm/schema-builder/view/View";
import { equalWithoutCase } from "./utils";


/**
 * @internal
 */
export class CDSMySQLSchemaBuilder extends RdbmsSchemaBuilder {

  /**
   * @override disable drop old columns
   */
  protected async executeSchemaSyncOperationsInProperOrder(): Promise<void> {
    await this.dropOldViews();
    await this.dropOldForeignKeys();
    await this.dropOldIndices();
    await this.dropOldChecks();
    await this.dropOldExclusions();
    await this.dropCompositeUniqueConstraints();
    await this.renameColumns();
    await this.createNewTables();
    // DO NOT drop old columns
    // await this.dropRemovedColumns();
    await this.addNewColumns();
    await this.updatePrimaryKeys();
    await this.updateExistColumns();
    await this.createNewIndices();
    await this.createNewChecks();
    await this.createNewExclusions();
    await this.createCompositeUniqueConstraints();
    await this.createForeignKeys();
    await this.createViews();
  }

  protected async createNewTables(): Promise<void> {
    for (const metadata of this.entityToSyncMetadatas) {
      // check if table does not exist yet
      const existTable = this.queryRunner.loadedTables.find(table =>
        equalWithoutCase(this.getTablePath(table), this.getTablePath(metadata))
      );
      if (existTable)
        continue;

      this.connection.logger.logSchemaBuild(`creating a new table: ${this.getTablePath(metadata)}`);

      // create a new table and sync it in the database
      const table = Table.create(metadata, this.connection.driver);
      await this.queryRunner.createTable(table, false, false);
      this.queryRunner.loadedTables.push(table);
    }
  }

  protected async createViews(): Promise<void> {
    for (const metadata of this.viewEntityToSyncMetadatas) {
      // check if view does not exist yet
      const existView = this.queryRunner.loadedViews.find((view) => {
        const viewExpression =
          typeof view.expression === "string"
            ? view.expression.trim()
            : view.expression(this.connection).getQuery();
        const metadataExpression =
          typeof metadata.expression === "string"
            ? metadata.expression.trim()
            : metadata.expression!(this.connection).getQuery();
        return (
          equalWithoutCase(this.getTablePath(view), this.getTablePath(metadata)) &&
          equalWithoutCase(viewExpression, metadataExpression)
        );
      });
      if (existView) continue;

      this.connection.logger.logSchemaBuild(
        `creating a new view: ${this.getTablePath(metadata)}`,
      );

      // create a new view and sync it in the database
      const view = View.create(metadata, this.connection.driver);
      await this.queryRunner.createView(view, true);
      this.queryRunner.loadedViews.push(view);
    }
  }

}
