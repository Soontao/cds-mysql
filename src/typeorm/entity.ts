/* eslint-disable max-len */
import { alg, Graph } from "@newdash/graphlib";
import { CSN, cwdRequireCDS, ElementDefinition, EntityDefinition, fuzzy, groupByKeyPrefix, Logger } from "cds-internal-tool";
import MySQLParser, { MySQLParserListener, SqlMode, TableRefContext } from "ts-mysql-parser";
import { EntitySchema, EntitySchemaColumnOptions } from "typeorm";
import { EntitySchemaOptions } from "typeorm/entity-schema/EntitySchemaOptions";
import { ANNOTATION_CDS_TYPEORM_CONFIG } from "../constants";

type TableName = string;

const logger: Logger = cwdRequireCDS().log("mysql|db|typeorm|entity");


interface EntitySchemaOptionsWithDeps extends EntitySchemaOptions<any> {
  /**
   * this view/table maybe depends other view/tables
   */
  deps?: TableName[];
}

const buildInTypes = {
  "cds.Decimal": "DECIMAL",
  "cds.DecimalFloat": "DECIMAL",
  "cds.Integer64": "BIGINT",
  "cds.Int64": "BIGINT",
  "cds.Integer": "INTEGER",
  "cds.Int32": "INTEGER",
  "cds.Int16": "SMALLINT",
  "cds.UInt8": "TINYINT",
  "cds.Double": "DOUBLE",
  "cds.Date": "DATE",
  "cds.Time": "TIME",
  "cds.DateTime": "DATETIME",
  "cds.Timestamp": "DATETIME",
  "cds.Boolean": "BOOLEAN",
  "cds.UUID": "VARCHAR",

  "cds.String": "VARCHAR",
  "cds.Binary": "VARBINARY",
  "cds.LargeBinary": "LONGBLOB",
  "cds.LargeString": "LONGTEXT",

  "cds.hana.SMALLINT": "SMALLINT",
  "cds.hana.TINYINT": "TINYINT",
  "cds.hana.REAL": "REAL",
  "cds.hana.NCHAR": "NCHAR",
  "cds.hana.VARCHAR": "VARCHAR",
  "cds.hana.CHAR": "CHAR",
  "cds.hana.CLOB": "CLOB",
  "cds.hana.LargeString": "LONGTEXT",
  "cds.hana.BINARY": "VARBINARY",
  "cds.hana.SMALLDECIMAL": "DECIMAL",
};

class CDSListener implements MySQLParserListener {

  private _deps: Array<string>;

  constructor() {
    this._deps = [];
  }

  // >> CREATE VIEW

  exitTableRef(ctx: TableRefContext) {
    // SELECT FROM (TABLEREF), for view reference
    // ANY JOIN FROM (TABLEREF)
    this._deps.push(ctx.text);
  }

  // << CREATE VIEW

  public getDeps() { return this._deps; }

}

function buildEntity(entityDef: EntityDefinition): EntitySchemaOptionsWithDeps {

  const name = entityDef.drafts === undefined ?
    entityDef.name.replace(/\./g, "_") :
    entityDef.drafts.name.replace(/\./g, "_");

  const schema: Partial<EntitySchemaOptionsWithDeps> = {
    name,
    tableName: name,
    synchronize: true,
  };

  schema.columns = Object
    .values(entityDef.elements)
    .filter(ele => ele?.virtual !== true && !["cds.Association", "cds.Composition"].includes(ele.type))
    .map(ele => buildColumn(ele)).reduce((pre, cur) => { pre[cur.name] = cur; return pre; }, {});


  const schemaConfig = groupByKeyPrefix(entityDef, ANNOTATION_CDS_TYPEORM_CONFIG) as Partial<EntitySchemaOptionsWithDeps>;

  // TODO: move to check
  if (schemaConfig.indices?.length > 0) {
    for (const indexConfig of schemaConfig.indices) {
      if (indexConfig?.columns instanceof Array) {
        for (const indexColumnName of indexConfig.columns) {
          if (typeof indexColumnName === "string") {
            const columnEle = fuzzy.findElement(entityDef, indexColumnName);
            if (columnEle === undefined) {
              logger.error(
                "entity", entityDef.name,
                "index", indexConfig.name,
                "column", indexColumnName,
                "not existed on entity definition"
              );
              throw cwdRequireCDS().error("ENTITY_INDEX_COLUMN_NOT_EXIST");
            }
          }
        }
      }
    }
  }

  if (schemaConfig !== undefined && Object.keys(schemaConfig).length > 0) {
    Object.assign(schema, schemaConfig);
  }

  return schema as any;
}

function buildView(name: string, stat: string): EntitySchemaOptions<any> {
  const options: Partial<EntitySchemaOptionsWithDeps> = {
    type: "view",
    name: name,
    columns: {},
    tableName: name,
    synchronize: true,
    deps: [],
  };

  options.expression = stat.substring(stat.indexOf("SELECT"));
  options.expression = options.expression
    .replace(/< strftime\('%Y-%m-%dT%H:%M:%S\.001Z', 'now'\)/g, "<= NOW()")
    .replace(/> strftime\('%Y-%m-%dT%H:%M:%S\.000Z', 'now'\)/g, "> NOW()");

  const listener = new CDSListener();
  const parser = new MySQLParser({ parserListener: listener, mode: SqlMode.AnsiQuotes });
  const result = parser.parse(stat);
  if (result.lexerError) {
    logger.error(
      "prase statement", stat,
      "failed, error", result.lexerError.message
    );
    throw TypeError("parse DDL statement failed");
  }
  if (result.parserError) {
    logger.error(
      "prase statement", stat,
      "failed, error", result.parserError.message
    );
    throw TypeError("parse DDL statement failed");
  }
  options.deps = listener.getDeps();


  return options as any;
}


function sortEntitySchemas(entities: Array<EntitySchema>): Array<EntitySchema> {

  // order by graph
  const g = new Graph();
  for (const entity of entities) {
    const { deps, tableName } = <EntitySchemaOptionsWithDeps>entity.options;
    g.setNode(tableName, entity);
    for (const dep of (deps ?? [])) {
      g.setEdge(tableName, dep);
    }
  }

  return alg.topsort(g).reverse().map((node) => g.node(node));

}

function buildColumn(eleDef: ElementDefinition): EntitySchemaColumnOptions {
  const column: Partial<EntitySchemaColumnOptions> = {
    name: eleDef.name,
    nullable: true,
  };
  const cds = cwdRequireCDS();

  if (eleDef instanceof cds.builtin.classes.array) {
    // for array of type
    column.type = buildInTypes["cds.LargeString"].toLowerCase() as any;
  }
  else if (!(eleDef.type in buildInTypes)) {
    logger.error("cds type", eleDef.type, "is not supported");
  }
  else {
    column.type = buildInTypes[eleDef.type].toLowerCase();
  }

  // force overwrite blob column
  if (eleDef.type === "cds.Binary" || eleDef.type === "cds.hana.BINARY") {
    column.length = eleDef.length;
  }

  if (eleDef.type === "cds.String" && eleDef.length === undefined) {
    column.type = "text";
    column.length = undefined;
  }

  // ref: https://dev.mysql.com/doc/refman/5.6/en/fractional-seconds.html
  // add fractional-seconds
  if (column.type === "datetime" && eleDef.type === "cds.Timestamp") {
    column.precision = 3;
  }

  // primary key
  if (eleDef.key === true) {
    column.primary = true;
    column.nullable = false;
  }

  // for temporary table valid from
  if (eleDef["@cds.valid.from"] === true) {
    column.primary = true;
    column.nullable = false;
  }

  if (eleDef.length !== undefined) {
    column.length = eleDef.length;
  }

  // Decimal(10, 2)
  if (eleDef.precision !== undefined) {
    column.precision = eleDef.precision;
  }

  if (eleDef.scale !== undefined) {
    column.scale = eleDef.scale;
  }

  // not null
  if (eleDef.notNull === true) {
    column.nullable = false;
  }

  // default value, only for val expr
  if (eleDef.default?.val !== undefined) {
    column.default = eleDef.default?.val;
  }

  if (eleDef.default?.func !== undefined) {
    if (column.type === "date" && String(eleDef.default?.func).toLowerCase() === "now") {
      logger?.debug(
        `column(${column.name}) default value skipped, because for 'date' datatype, mysql not support the default value '${eleDef.default?.func}()'`
      );
    } else {
      column.default = () => `${String(eleDef.default?.func).toUpperCase()}()`;
    }
  }

  // not association or composition
  if (!["cds.Association", "cds.Composition"].includes(eleDef.type)) {
    const typeOrmColumnConfig = groupByKeyPrefix(eleDef, ANNOTATION_CDS_TYPEORM_CONFIG);
    // merge @cds.typeorm.config annotation
    if (typeOrmColumnConfig !== undefined && Object.keys(typeOrmColumnConfig).length > 0) {
      Object.assign(
        column,
        typeOrmColumnConfig,
      );
    }
  }

  return column as any;
}

function extractInfo(ddl: string): { type: "table" | "view" | "unknown", name: string } {
  if (ddl.startsWith("CREATE TABLE")) {
    const start = "CREATE TABLE ".length;
    const name = ddl.substring(start, ddl.indexOf(" ", start));
    return { type: "table", name };
  }
  if (ddl.startsWith("CREATE VIEW")) {
    const start = "CREATE VIEW ".length;
    const name = ddl.substring(start, ddl.indexOf(" ", start));
    return { type: "view", name };
  }
  return { type: "unknown", name: "unknown" };
}

/**
 * convert csn to typeorm entities
 *
 * @param model plain CSN model
 */
export function csnToEntity(model: CSN): Array<EntitySchema> {
  const cds = cwdRequireCDS();
  const linkedModel = cds.reflect(cds.compile.for.nodejs(model));
  // force to use 'sqlite' as dialect to support localized elements
  const statements = cds.compile.to.sql(model, { dialect: "sqlite" }) as Array<string>;

  const entities: Array<EntitySchema> = statements.map(statement => {
    const { type, name } = extractInfo(statement);
    switch (type) {
      case "table":
        return new EntitySchema(buildEntity(fuzzy.findEntity(name, linkedModel)));
      case "view":
        return new EntitySchema(buildView(name, statement));
      default:
        logger.error("unknown DDL type", statement);
        break;
    }
  });

  return sortEntitySchemas(entities);
}


