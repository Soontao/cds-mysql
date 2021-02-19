import { ConnectionOptions, createConnection } from "typeorm";
import { RdbmsSchemaBuilder } from "typeorm/schema-builder/RdbmsSchemaBuilder";

/**
 * @internal
 */
class SchemaBuilder extends RdbmsSchemaBuilder {

  /**
   * @override disable drop old column issue
   */
  protected async executeSchemaSyncOperationsInProperOrder(): Promise<void> {
    // await this.dropOldViews();
    // await this.dropOldForeignKeys();
    await this.dropOldIndices();
    await this.dropOldChecks();
    // await this.dropOldExclusions();
    // await this.dropCompositeUniqueConstraints();
    await this.renameColumns();
    await this.createNewTables();
    // DO NOT drop old columns
    // await this.dropRemovedColumns(); 
    await this.addNewColumns();
    await this.updatePrimaryKeys();
    await this.updateExistColumns();
    await this.createNewIndices();
    await this.createNewChecks();
    // await this.createNewExclusions();
    // await this.createCompositeUniqueConstraints();
    // await this.createForeignKeys();
    // await this.createViews();
  }
}

export async function migrate(connectionOptions: ConnectionOptions) {
  const conn = await createConnection(connectionOptions);
  try {
    const builder = new SchemaBuilder(conn);
    await builder.build(); // execute build
  } finally {
    if (conn.isConnected) {
      await conn.close();
    }
  }
}