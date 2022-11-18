/* eslint-disable max-len */
import { alg, Graph } from "@newdash/graphlib";
import { CSN, cwdRequireCDS, ElementDefinition, EntityDefinition, fuzzy, groupByKeyPrefix, LinkedModel, Logger } from "cds-internal-tool";
import MySQLParser, {
  CreateViewContext,
  MySQLParserListener,
  SqlMode, TableNameContext,
  TableRefContext
} from "ts-mysql-parser";
import { EntitySchema, EntitySchemaColumnOptions } from "typeorm";
import { EntitySchemaOptions } from "typeorm/entity-schema/EntitySchemaOptions";
import { ANNOTATION_CDS_TYPEORM_CONFIG } from "../constants";
import { _isQuoted } from "../customBuilder/replacement/quotingStyles";
import { overwriteCDSCoreTypes } from "../utils";

type TableName = string;

const logger: Logger = cwdRequireCDS().log("mysql|db|typeorm|entity");


interface EntitySchemaOptionsWithDeps extends EntitySchemaOptions<any> {
  /**
   * this view/table maybe depends other view/tables
   */
  deps?: TableName[];
}

const buildInTypes = {
  "cds.String": "NVARCHAR",
  "cds.hana.NCHAR": "NCHAR",
  "cds.hana.VARCHAR": "VARCHAR",
  "cds.hana.CHAR": "CHAR",
  "cds.hana.CLOB": "CLOB",
  "cds.Decimal": "DECIMAL",
  "cds.DecimalFloat": "DECIMAL",
  "cds.Integer64": "BIGINT",
  "cds.Integer": "INTEGER",
  "cds.Int64": "BIGINT",
  "cds.Int32": "INTEGER",
  "cds.Int16": "SMALLINT",
  "cds.UInt8": "TINYINT",
  "cds.hana.SMALLINT": "SMALLINT",
  "cds.hana.TINYINT": "TINYINT",
  "cds.Double": "DOUBLE",
  "cds.hana.REAL": "REAL",
  "cds.Date": "DATE",
  "cds.Time": "TIME",
  "cds.DateTime": "TIMESTAMP",
  "cds.Timestamp": "TIMESTAMP",
  "cds.Boolean": "BOOLEAN",
  "cds.UUID": "NVARCHAR",

  "cds.Binary": "VARBINARY",
  "cds.LargeBinary": "LONGBLOB",
  "cds.hana.BINARY": "VARBINARY",
  "cds.hana.SMALLDECIMAL": "DECIMAL",
  "cds.LargeString": "LONGTEXT",
  "cds.hana.LargeString": "LONGTEXT"
};


class CDSListener implements MySQLParserListener {
  private _entities: Array<EntitySchema>;

  private _tmp: EntitySchemaOptionsWithDeps;

  private _currentStatement: string;

  private _model: LinkedModel;

  constructor(options: any) {
    this._entities = [];
    this._tmp = this.newEntitySchemaOption();
    this._currentStatement = "";
    this._model = options.model;
  }

  private _getTextWithoutQuote(text: string) {
    return _isQuoted(text) ? text.substring(1, text.length - 1) : text;
  }

  // >> CREATE TABLE

  exitTableName(ctx: TableNameContext) {
    const name = this._getTextWithoutQuote(ctx.text);
    const entityDef = fuzzy.findEntity(name, this._model);
    this._entities.push(new EntitySchema(buildSchema(entityDef)));
    this._tmp = this.newEntitySchemaOption();
  }

  private newEntitySchemaOption(): EntitySchemaOptionsWithDeps {
    return { name: "", columns: {}, synchronize: true, deps: [] };
  }


  // << CREATE TABLE

  // >> CREATE VIEW

  exitCreateView(ctx: CreateViewContext) {
    const viewName = ctx.viewName();
    const select = ctx.viewTail()?.viewSelect();
    if (viewName && select) {
      this._tmp.type = "view";
      this._tmp.name = viewName.text;
      this._tmp.tableName = viewName.text;
      // extract (SELECT FROM ...) part from original plain SQL
      const exp = this._currentStatement.substring(select.start.startIndex);
      // REVISIT: maybe support time travel
      // replace for temporal data
      this._tmp.expression = exp
        .replace(/< strftime\('%Y-%m-%dT%H:%M:%S\.001Z', 'now'\)/g, "<= NOW()")
        .replace(/> strftime\('%Y-%m-%dT%H:%M:%S\.000Z', 'now'\)/g, "> NOW()");
    }
    this._entities.push(new EntitySchema(this._tmp));
    this._tmp = this.newEntitySchemaOption();
  }

  exitTableRef(ctx: TableRefContext) {
    // SELECT FROM (TABLEREF), for view reference
    // ANY JOIN FROM (TABLEREF)
    this._tmp.deps.push(ctx.text);
  }

  // << CREATE VIEW

  /**
   * get entity schemas after parsing
   */
  public getEntitySchemas(): Array<EntitySchema> {
    if (this._entities && this._entities.length > 0) {
      return sortEntitySchemas(this._entities);
    }

    return this._entities;
  }

  /**
   * set current statement
   *
   * @param stat
   */
  public setCurrentStatement(stat: string) {
    this._currentStatement = stat;
  }
}

function buildSchema(entityDef: EntityDefinition): EntitySchemaOptionsWithDeps {

  let name = entityDef.name.replace(/\./g, "_");

  if (entityDef["@odata.draft.enabled"] === true) {
    name += "_drafts";
  }

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
              // TODO: throw error
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

function sortEntitySchemas(entities: Array<EntitySchema>): Array<EntitySchema> {

  // order by graph
  const g = new Graph();
  entities.forEach((entity) => {
    const { deps, tableName } = <EntitySchemaOptionsWithDeps>entity.options;
    g.setNode(tableName, entity);
    if (deps && deps.length > 0) { // VIEW
      deps.forEach((dep) => g.setEdge(tableName, dep));
    }
  });

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
  if (eleDef.type === "cds.Binary") {
    column.length = eleDef.length;
  }

  if (eleDef.type === "cds.String" && eleDef.length === undefined) {
    column.type = "text";
    column.length = undefined;
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

// function convertSqlToSchema(model: LinkedModel, ddl: string): EntitySchemaOptionsWithDeps {
//   ddl = ddl.trim()

//   if (ddl.startsWith("CREATE TABLE")) {
//     const tableStart = "CREATE TABLE ".length
//     const tableName = ddl.substring(tableStart, ddl.indexOf(" ", tableStart))
//     const schema: EntitySchemaOptionsWithDeps = {}
//     return schema
//   }

//   if (ddl.startsWith("CREATE VIEW")) {

//   }

//   throw new TypeError(`can not process sql: ${ddl}`)
// }

/**
 * convert csn to typeorm entities
 *
 * @param model plain CSN model
 */
export function csnToEntity(model: CSN): Array<EntitySchema> {
  const cds = cwdRequireCDS();
  overwriteCDSCoreTypes();
  // @ts-ignore
  const listener: CDSListener = new CDSListener({ model: cds.linked(cds.compile.for.nodejs(model)) });
  const parser = new MySQLParser({ parserListener: listener, mode: SqlMode.AnsiQuotes });
  // force to use 'sqlite' as dialect to support localized elements
  const statements = cds.compile.to.sql(model, { dialect: "sqlite" });
  statements.forEach((stat: string) => {
    listener.setCurrentStatement(stat);
    const result = parser.parse(stat);
    if (result.lexerError) {
      throw result.lexerError;
    }
    if (result.parserError) {
      logger.error(
        "prase statement", stat,
        "failed, error", result.parserError.message
      );
      throw result.parserError;
    }
  });
  return listener.getEntitySchemas();
}
