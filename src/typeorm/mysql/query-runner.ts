/* eslint-disable prefer-const */
/* eslint-disable max-len */
import { ObjectLiteral } from "typeorm/common/ObjectLiteral";
import { MysqlQueryRunner } from "typeorm/driver/mysql/MysqlQueryRunner";
import { Query } from "typeorm/driver/Query";
import { ColumnType } from "typeorm/driver/types/ColumnTypes";
import { MetadataTableType } from "typeorm/driver/types/MetadataTableType";
import { TableIndexOptions } from "typeorm/schema-builder/options/TableIndexOptions";
import {
  Table
} from "typeorm/schema-builder/table/Table";
import {
  TableColumn
} from "typeorm/schema-builder/table/TableColumn";
import { TableForeignKey } from "typeorm/schema-builder/table/TableForeignKey";
import {
  TableIndex
} from "typeorm/schema-builder/table/TableIndex";
import { OrmUtils } from "typeorm/util/OrmUtils";
import { VersionUtils } from "typeorm/util/VersionUtils";
import { MYSQL_CHARSET, MYSQL_COLLATE } from "../../constants";
import { equalWithoutCase } from "./utils";

/**
 * @internal
 */
export class CDSMySQLQueryRunner extends MysqlQueryRunner {

  /**
   * Builds create table sql
   */
  protected createTableSql(table: Table, createForeignKeys?: boolean): Query {
    // enhance charset
    let sql = super.createTableSql(table, createForeignKeys).query;
    sql += ` CHARACTER SET '${MYSQL_CHARSET}' COLLATE '${MYSQL_COLLATE}'`;
    return new Query(sql);
  }

  /**
     * Loads all tables (with given names) from the database and creates a Table from them.
     */
  protected async loadTables(tableNames?: string[]): Promise<Table[]> {
    if (tableNames && tableNames.length === 0) {
      return [];
    }

    const currentDatabase = await this.getCurrentDatabase();

    // The following SQL brought to you by:
    //   A terrible understanding of https://dev.mysql.com/doc/refman/8.0/en/information-schema-optimization.html
    //
    // Short Version:
    // INFORMATION_SCHEMA is a weird metadata virtual table and follows VERY FEW of the normal
    // query optimization rules.  Depending on the columns you query against & the columns you're SELECTing
    // there can be a drastically different query performance - this is because the tables map to
    // data on the disk and some pieces of data require a scan of the data directory, the database files, etc

    // With most of these, you'll want to do an `EXPLAIN` when making changes to make sure
    // the changes you're making aren't changing the query performance profile negatively
    // When you do the explain you'll want to look at the `Extra` field -
    // It will look something like: "Using where; {FILE_OPENING}; Scanned {DB_NUM} databases"
    // FILE_OPENING will commonly be OPEN_FRM_ONLY or OPEN_FULL_TABLE - you want to aim to NOT do
    // an OPEN_FULL_TABLE unless necessary. DB_NUM may be a number or "all" - you really want to
    // keep this to 0 or 1.  Ideally 0. "All" means you've scanned all databases - not good.
    //
    // For more info, see the above link to the MySQL docs.
    //
    // Something not noted in the docs is that complex `WHERE` clauses - such as `OR` expressions -
    // will cause the query to not hit the optimizations & do full scans.  This is why
    // a number of queries below do `UNION`s of single `WHERE` clauses.

    const dbTables: { TABLE_SCHEMA: string; TABLE_NAME: string }[] = [];

    if (!tableNames) {
      // Since we don't have any of this data we have to do a scan
      const tablesSql = `SELECT \`TABLE_SCHEMA\`, \`TABLE_NAME\` FROM \`INFORMATION_SCHEMA\`.\`TABLES\``;

      dbTables.push(...(await this.query(tablesSql)));
    } else {
      // Avoid data directory scan: TABLE_SCHEMA
      // Avoid database directory scan: TABLE_NAME
      // We only use `TABLE_SCHEMA` and `TABLE_NAME` which is `SKIP_OPEN_TABLE`
      const tablesSql = tableNames
        .filter((tableName) => tableName)
        .map((tableName) => {
          let { database, tableName: name } =
            this.driver.parseTableName(tableName);

          if (!database) {
            database = currentDatabase;
          }

          return `SELECT \`TABLE_SCHEMA\`, \`TABLE_NAME\` FROM \`INFORMATION_SCHEMA\`.\`TABLES\` WHERE \`TABLE_SCHEMA\` = '${database}' AND \`TABLE_NAME\` = '${name}'`;
        })
        .join(" UNION ");

      dbTables.push(...(await this.query(tablesSql)));
    }

    // if tables were not found in the db, no need to proceed
    if (!dbTables.length) return [];

    // Avoid data directory scan: TABLE_SCHEMA
    // Avoid database directory scan: TABLE_NAME
    // Full columns: CARDINALITY & INDEX_TYPE - everything else is FRM only
    const statsSubquerySql = dbTables
      .map(({ TABLE_SCHEMA, TABLE_NAME }) => {
        return `
            SELECT
                *
            FROM \`INFORMATION_SCHEMA\`.\`STATISTICS\`
            WHERE
                \`TABLE_SCHEMA\` = '${TABLE_SCHEMA}'
                AND
                \`TABLE_NAME\` = '${TABLE_NAME}'
        `;
      })
      .join(" UNION ");

    // Avoid data directory scan: TABLE_SCHEMA
    // Avoid database directory scan: TABLE_NAME
    // All columns will hit the full table.
    const kcuSubquerySql = dbTables
      .map(({ TABLE_SCHEMA, TABLE_NAME }) => {
        return `
            SELECT
                *
            FROM \`INFORMATION_SCHEMA\`.\`KEY_COLUMN_USAGE\` \`kcu\`
            WHERE
                \`kcu\`.\`TABLE_SCHEMA\` = '${TABLE_SCHEMA}'
                AND
                \`kcu\`.\`TABLE_NAME\` = '${TABLE_NAME}'
        `;
      })
      .join(" UNION ");

    // Avoid data directory scan: CONSTRAINT_SCHEMA
    // Avoid database directory scan: TABLE_NAME
    // All columns will hit the full table.
    const rcSubquerySql = dbTables
      .map(({ TABLE_SCHEMA, TABLE_NAME }) => {
        return `
            SELECT
                *
            FROM \`INFORMATION_SCHEMA\`.\`REFERENTIAL_CONSTRAINTS\`
            WHERE
                \`CONSTRAINT_SCHEMA\` = '${TABLE_SCHEMA}'
                AND
                \`TABLE_NAME\` = '${TABLE_NAME}'
        `;
      })
      .join(" UNION ");

    // Avoid data directory scan: TABLE_SCHEMA
    // Avoid database directory scan: TABLE_NAME
    // OPEN_FRM_ONLY applies to all columns
    const columnsSql = dbTables
      .map(({ TABLE_SCHEMA, TABLE_NAME }) => {
        return `
            SELECT
                *
            FROM
                \`INFORMATION_SCHEMA\`.\`COLUMNS\`
            WHERE
                \`TABLE_SCHEMA\` = '${TABLE_SCHEMA}'
                AND
                \`TABLE_NAME\` = '${TABLE_NAME}'
            `;
      })
      .join(" UNION ");

    // No Optimizations are available for COLLATIONS
    const collationsSql = `
        SELECT
            \`SCHEMA_NAME\`,
            \`DEFAULT_CHARACTER_SET_NAME\` as \`CHARSET\`,
            \`DEFAULT_COLLATION_NAME\` AS \`COLLATION\`
        FROM \`INFORMATION_SCHEMA\`.\`SCHEMATA\`
        `;

    // Key Column Usage but only for PKs
    const primaryKeySql = `SELECT * FROM (${kcuSubquerySql}) \`kcu\` WHERE \`CONSTRAINT_NAME\` = 'PRIMARY'`;

    // Combine stats & referential constraints
    const indicesSql = `
        SELECT
            \`s\`.*
        FROM (${statsSubquerySql}) \`s\`
        LEFT JOIN (${rcSubquerySql}) \`rc\`
            ON
                \`s\`.\`INDEX_NAME\` = \`rc\`.\`CONSTRAINT_NAME\`
                AND
                \`s\`.\`TABLE_SCHEMA\` = \`rc\`.\`CONSTRAINT_SCHEMA\`
        WHERE
            \`s\`.\`INDEX_NAME\` != 'PRIMARY'
            AND
            \`rc\`.\`CONSTRAINT_NAME\` IS NULL
        `;

    // Combine Key Column Usage & Referential Constraints
    const foreignKeysSql = `
        SELECT
            \`kcu\`.\`TABLE_SCHEMA\`,
            \`kcu\`.\`TABLE_NAME\`,
            \`kcu\`.\`CONSTRAINT_NAME\`,
            \`kcu\`.\`COLUMN_NAME\`,
            \`kcu\`.\`REFERENCED_TABLE_SCHEMA\`,
            \`kcu\`.\`REFERENCED_TABLE_NAME\`,
            \`kcu\`.\`REFERENCED_COLUMN_NAME\`,
            \`rc\`.\`DELETE_RULE\` \`ON_DELETE\`,
            \`rc\`.\`UPDATE_RULE\` \`ON_UPDATE\`
        FROM (${kcuSubquerySql}) \`kcu\`
        INNER JOIN (${rcSubquerySql}) \`rc\`
            ON
                \`rc\`.\`CONSTRAINT_SCHEMA\` = \`kcu\`.\`CONSTRAINT_SCHEMA\`
                AND
                \`rc\`.\`TABLE_NAME\` = \`kcu\`.\`TABLE_NAME\`
                AND
                \`rc\`.\`CONSTRAINT_NAME\` = \`kcu\`.\`CONSTRAINT_NAME\`
        `;

    const [
      dbColumns,
      dbPrimaryKeys,
      dbCollations,
      dbIndices,
      dbForeignKeys,
    ]: ObjectLiteral[][] = await Promise.all([
      this.query(columnsSql),
      this.query(primaryKeySql),
      this.query(collationsSql),
      this.query(indicesSql),
      this.query(foreignKeysSql),
    ]);

    const isMariaDb = this.driver.options.type === "mariadb";
    const dbVersion = await this.getVersion();

    // create tables for loaded tables
    return Promise.all(
      dbTables.map(async (dbTable) => {
        const table = new Table();

        const dbCollation = dbCollations.find(
          (coll) => coll["SCHEMA_NAME"] === dbTable["TABLE_SCHEMA"],
        )!;
        const defaultCollation = dbCollation["COLLATION"];
        const defaultCharset = dbCollation["CHARSET"];

        // We do not need to join database name, when database is by default.
        const db =
          dbTable["TABLE_SCHEMA"] === currentDatabase
            ? undefined
            : dbTable["TABLE_SCHEMA"];
        table.database = dbTable["TABLE_SCHEMA"];
        table.name = this.driver.buildTableName(
          dbTable["TABLE_NAME"],
          undefined,
          db,
        );

        // create columns from the loaded columns
        table.columns = await Promise.all(
          dbColumns
            .filter(
              (dbColumn) =>
                dbColumn["TABLE_NAME"] ===
                dbTable["TABLE_NAME"] &&
                dbColumn["TABLE_SCHEMA"] ===
                dbTable["TABLE_SCHEMA"],
            )
            .map(async (dbColumn) => {
              const columnUniqueIndices = dbIndices.filter(
                (dbIndex) => {
                  return (
                    dbIndex["TABLE_NAME"] ===
                    dbTable["TABLE_NAME"] &&
                    dbIndex["TABLE_SCHEMA"] ===
                    dbTable["TABLE_SCHEMA"] &&
                    dbIndex["COLUMN_NAME"] ===
                    dbColumn["COLUMN_NAME"] &&
                    parseInt(dbIndex["NON_UNIQUE"], 10) ===
                    0
                  );
                },
              );

              const tableMetadata =
                this.connection.entityMetadatas.find(
                  (metadata) => equalWithoutCase(this.getTablePath(table), this.getTablePath(metadata))
                );
              const hasIgnoredIndex =
                columnUniqueIndices.length > 0 &&
                tableMetadata &&
                tableMetadata.indices.some((index) => {
                  return columnUniqueIndices.some(
                    (uniqueIndex) => {
                      return (
                        index.name ===
                        uniqueIndex["INDEX_NAME"] &&
                        index.synchronize === false
                      );
                    },
                  );
                });

              const isConstraintComposite =
                columnUniqueIndices.every((uniqueIndex) => {
                  return dbIndices.some(
                    (dbIndex) =>
                      dbIndex["INDEX_NAME"] ===
                      uniqueIndex["INDEX_NAME"] &&
                      dbIndex["COLUMN_NAME"] !==
                      dbColumn["COLUMN_NAME"],
                  );
                });

              const tableColumn = new TableColumn();
              tableColumn.name = dbColumn["COLUMN_NAME"];
              tableColumn.type =
                dbColumn["DATA_TYPE"].toLowerCase();

              // since mysql 8.0, "geometrycollection" returned as "geomcollection"
              // typeorm still use "geometrycollection"
              if (tableColumn.type === "geomcollection") {
                tableColumn.type = "geometrycollection";
              }

              tableColumn.zerofill =
                dbColumn["COLUMN_TYPE"].indexOf("zerofill") !==
                -1;
              tableColumn.unsigned = tableColumn.zerofill
                ? true
                : dbColumn["COLUMN_TYPE"].indexOf(
                  "unsigned",
                ) !== -1;
              if (
                this.driver.withWidthColumnTypes.indexOf(
                  tableColumn.type as ColumnType,
                ) !== -1
              ) {
                const width = dbColumn["COLUMN_TYPE"].substring(
                  dbColumn["COLUMN_TYPE"].indexOf("(") + 1,
                  dbColumn["COLUMN_TYPE"].indexOf(")"),
                );
                tableColumn.width =
                  width &&
                    !this.isDefaultColumnWidth(
                      table,
                      tableColumn,
                      parseInt(width),
                    )
                    ? parseInt(width)
                    : undefined;
              }

              if (
                dbColumn["COLUMN_DEFAULT"] === null ||
                dbColumn["COLUMN_DEFAULT"] === undefined ||
                (isMariaDb &&
                  dbColumn["COLUMN_DEFAULT"] === "NULL")
              ) {
                tableColumn.default = undefined;
              } else if (
                /^CURRENT_TIMESTAMP(\([0-9]*\))?$/i.test(
                  dbColumn["COLUMN_DEFAULT"],
                )
              ) {
                // New versions of MariaDB return expressions in lowercase.  We need to set it in
                // uppercase so the comparison in MysqlDriver#compareDefaultValues does not fail.
                tableColumn.default =
                  dbColumn["COLUMN_DEFAULT"].toUpperCase();
              } else if (
                isMariaDb &&
                VersionUtils.isGreaterOrEqual(
                  dbVersion,
                  "10.2.7",
                )
              ) {
                // MariaDB started adding quotes to literals in COLUMN_DEFAULT since version 10.2.7
                // See https://mariadb.com/kb/en/library/information-schema-columns-table/
                tableColumn.default = dbColumn["COLUMN_DEFAULT"];
              } else {
                tableColumn.default = `'${dbColumn["COLUMN_DEFAULT"]}'`;
              }

              if (dbColumn["EXTRA"].indexOf("on update") !== -1) {
                // New versions of MariaDB return expressions in lowercase.  We need to set it in
                // uppercase so the comparison in MysqlDriver#compareExtraValues does not fail.
                tableColumn.onUpdate = dbColumn["EXTRA"]
                  .substring(
                    dbColumn["EXTRA"].indexOf("on update") +
                    10,
                  )
                  .toUpperCase();
              }

              if (dbColumn["GENERATION_EXPRESSION"]) {
                tableColumn.generatedType =
                  dbColumn["EXTRA"].indexOf("VIRTUAL") !== -1
                    ? "VIRTUAL"
                    : "STORED";

                // We cannot relay on information_schema.columns.generation_expression, because it is formatted different.
                const asExpressionQuery =
                  await this.selectTypeormMetadataSql({
                    schema: dbTable["TABLE_SCHEMA"],
                    table: dbTable["TABLE_NAME"],
                    type: MetadataTableType.GENERATED_COLUMN,
                    name: tableColumn.name,
                  });

                const results = await this.query(
                  asExpressionQuery.query,
                  asExpressionQuery.parameters,
                );
                if (results[0] && results[0].value) {
                  tableColumn.asExpression = results[0].value;
                } else {
                  tableColumn.asExpression = "";
                }
              }

              tableColumn.isUnique =
                columnUniqueIndices.length > 0 &&
                !hasIgnoredIndex &&
                !isConstraintComposite;

              if (isMariaDb && tableColumn.generatedType) {
                // do nothing - MariaDB does not support NULL/NOT NULL expressions for generated columns
              } else {
                tableColumn.isNullable =
                  dbColumn["IS_NULLABLE"] === "YES";
              }

              tableColumn.isPrimary = dbPrimaryKeys.some(
                (dbPrimaryKey) => {
                  return (
                    dbPrimaryKey["TABLE_NAME"] ===
                    dbColumn["TABLE_NAME"] &&
                    dbPrimaryKey["TABLE_SCHEMA"] ===
                    dbColumn["TABLE_SCHEMA"] &&
                    dbPrimaryKey["COLUMN_NAME"] ===
                    dbColumn["COLUMN_NAME"]
                  );
                },
              );
              tableColumn.isGenerated =
                dbColumn["EXTRA"].indexOf("auto_increment") !==
                -1;
              if (tableColumn.isGenerated)
                tableColumn.generationStrategy = "increment";

              tableColumn.comment =
                typeof dbColumn["COLUMN_COMMENT"] ===
                  "string" &&
                  dbColumn["COLUMN_COMMENT"].length === 0
                  ? undefined
                  : dbColumn["COLUMN_COMMENT"];
              if (dbColumn["CHARACTER_SET_NAME"])
                tableColumn.charset =
                  dbColumn["CHARACTER_SET_NAME"] ===
                    defaultCharset
                    ? undefined
                    : dbColumn["CHARACTER_SET_NAME"];
              if (dbColumn["COLLATION_NAME"])
                tableColumn.collation =
                  dbColumn["COLLATION_NAME"] ===
                    defaultCollation
                    ? undefined
                    : dbColumn["COLLATION_NAME"];

              // check only columns that have length property
              if (
                this.driver.withLengthColumnTypes.indexOf(
                  tableColumn.type as ColumnType,
                ) !== -1 &&
                dbColumn["CHARACTER_MAXIMUM_LENGTH"]
              ) {
                const length =
                  dbColumn[
                    "CHARACTER_MAXIMUM_LENGTH"
                  ].toString();
                tableColumn.length =
                  !this.isDefaultColumnLength(
                    table,
                    tableColumn,
                    length,
                  )
                    ? length
                    : "";
              }

              if (
                tableColumn.type === "decimal" ||
                tableColumn.type === "double" ||
                tableColumn.type === "float"
              ) {
                if (
                  dbColumn["NUMERIC_PRECISION"] !== null &&
                  !this.isDefaultColumnPrecision(
                    table,
                    tableColumn,
                    dbColumn["NUMERIC_PRECISION"],
                  )
                )
                  tableColumn.precision = parseInt(
                    dbColumn["NUMERIC_PRECISION"],
                  );
                if (
                  dbColumn["NUMERIC_SCALE"] !== null &&
                  !this.isDefaultColumnScale(
                    table,
                    tableColumn,
                    dbColumn["NUMERIC_SCALE"],
                  )
                )
                  tableColumn.scale = parseInt(
                    dbColumn["NUMERIC_SCALE"],
                  );
              }

              if (
                tableColumn.type === "enum" ||
                tableColumn.type === "simple-enum" ||
                tableColumn.type === "set"
              ) {
                const colType = dbColumn["COLUMN_TYPE"];
                const items = colType
                  .substring(
                    colType.indexOf("(") + 1,
                    colType.lastIndexOf(")"),
                  )
                  .split(",");
                tableColumn.enum = (items as string[]).map(
                  (item) => {
                    return item.substring(
                      1,
                      item.length - 1,
                    );
                  },
                );
                tableColumn.length = "";
              }

              if (
                (tableColumn.type === "datetime" ||
                  tableColumn.type === "time" ||
                  tableColumn.type === "timestamp") &&
                dbColumn["DATETIME_PRECISION"] !== null &&
                dbColumn["DATETIME_PRECISION"] !== undefined &&
                !this.isDefaultColumnPrecision(
                  table,
                  tableColumn,
                  parseInt(dbColumn["DATETIME_PRECISION"]),
                )
              ) {
                tableColumn.precision = parseInt(
                  dbColumn["DATETIME_PRECISION"],
                );
              }

              return tableColumn;
            }),
        );

        // find foreign key constraints of table, group them by constraint name and build TableForeignKey.
        const tableForeignKeyConstraints = OrmUtils.uniq(
          dbForeignKeys.filter((dbForeignKey) => {
            return (
              dbForeignKey["TABLE_NAME"] ===
              dbTable["TABLE_NAME"] &&
              dbForeignKey["TABLE_SCHEMA"] ===
              dbTable["TABLE_SCHEMA"]
            );
          }),
          (dbForeignKey) => dbForeignKey["CONSTRAINT_NAME"],
        );

        table.foreignKeys = tableForeignKeyConstraints.map(
          (dbForeignKey) => {
            const foreignKeys = dbForeignKeys.filter(
              (dbFk) =>
                dbFk["CONSTRAINT_NAME"] ===
                dbForeignKey["CONSTRAINT_NAME"],
            );

            // if referenced table located in currently used db, we don't need to concat db name to table name.
            const database =
              dbForeignKey["REFERENCED_TABLE_SCHEMA"] ===
                currentDatabase
                ? undefined
                : dbForeignKey["REFERENCED_TABLE_SCHEMA"];
            const referencedTableName = this.driver.buildTableName(
              dbForeignKey["REFERENCED_TABLE_NAME"],
              undefined,
              database,
            );

            return new TableForeignKey({
              name: dbForeignKey["CONSTRAINT_NAME"],
              columnNames: foreignKeys.map(
                (dbFk) => dbFk["COLUMN_NAME"],
              ),
              referencedDatabase:
                dbForeignKey["REFERENCED_TABLE_SCHEMA"],
              referencedTableName: referencedTableName,
              referencedColumnNames: foreignKeys.map(
                (dbFk) => dbFk["REFERENCED_COLUMN_NAME"],
              ),
              onDelete: dbForeignKey["ON_DELETE"],
              onUpdate: dbForeignKey["ON_UPDATE"],
            });
          },
        );

        // find index constraints of table, group them by constraint name and build TableIndex.
        const tableIndexConstraints = OrmUtils.uniq(
          dbIndices.filter(
            (dbIndex) =>
              dbIndex["TABLE_NAME"] === dbTable["TABLE_NAME"] &&
              dbIndex["TABLE_SCHEMA"] === dbTable["TABLE_SCHEMA"],
          ),
          (dbIndex) => dbIndex["INDEX_NAME"],
        );

        table.indices = tableIndexConstraints.map((constraint) => {
          const indices = dbIndices.filter((index) => {
            return (
              index["TABLE_SCHEMA"] ===
              constraint["TABLE_SCHEMA"] &&
              index["TABLE_NAME"] === constraint["TABLE_NAME"] &&
              index["INDEX_NAME"] === constraint["INDEX_NAME"]
            );
          });

          const nonUnique = parseInt(constraint["NON_UNIQUE"], 10);

          return new TableIndex(<TableIndexOptions>{
            table: table,
            name: constraint["INDEX_NAME"],
            columnNames: indices.map((i) => i["COLUMN_NAME"]),
            isUnique: nonUnique === 0,
            isSpatial: constraint["INDEX_TYPE"] === "SPATIAL",
            isFulltext: constraint["INDEX_TYPE"] === "FULLTEXT",
          });
        });

        return table;
      }),
    );
  }


}