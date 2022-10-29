/* eslint-disable max-len */
import { alg, Graph } from "@newdash/graphlib";
import { trimPrefix, trimSuffix } from "@newdash/newdash";
import { CSN, cwdRequireCDS, fuzzy, groupByKeyPrefix, LinkedModel, Logger } from "cds-internal-tool";
import MySQLParser, {
  ColumnDefinitionContext,
  CreateTableContext,
  CreateViewContext,
  MySQLParserListener,
  SqlMode,
  TableConstraintDefContext,
  TableNameContext,
  TableRefContext
} from "ts-mysql-parser";
import { ColumnType, EntitySchema, EntitySchemaColumnOptions } from "typeorm";
import { EntitySchemaOptions } from "typeorm/entity-schema/EntitySchemaOptions";
import { ANNOTATION_CDS_TYPEORM_CONFIG } from "../constants";
import { _isQuoted } from "../customBuilder/replacement/quotingStyles";
import { overwriteCDSCoreTypes } from "../utils";

type TableName = string;

const logger: Logger = cwdRequireCDS().log("mysql|db|typeorm|entity");

const TextColumnTypes: Array<ColumnType> = [
  "varchar",
  "varchar2",
  "nvarchar",
  "nvarchar2",
  "char"
];

const DEFAULT_STRING_LENGTH = 5000;

interface EntitySchemaOptionsWithDeps extends EntitySchemaOptions<any> {
  /**
   * this view/table maybe depends other view/tables
   */
  deps: TableName[];
}


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
    this._tmp.name = name;
    this._tmp.tableName = name;
  }

  async exitColumnDefinition(ctx: ColumnDefinitionContext) {
    // mapping DDL column definition to schema options
    const name = ctx.columnName();
    const field = ctx.fieldDefinition();
    const dataType = field.dataType();
    const length = dataType.fieldLength();
    const floatOption = dataType.floatOptions();
    const attrs = field.columnAttribute();

    const column: EntitySchemaColumnOptions = {
      name: this._getTextWithoutQuote(name.text),
      type: <ColumnType>dataType.getChild(0).text.toLowerCase(),
      nullable: true, // default can be null
      default: null
    };


    const entityDef = fuzzy.findEntity(this._tmp.tableName, this._model);

    if (entityDef !== undefined) {
      // for draft table, it could not found metadata in model
      const eleDef = fuzzy.findElement(entityDef, column.name);

      // TODO: use element def directly

      if (eleDef !== undefined) {
        // force overwrite blob column
        if (eleDef.type === "cds.Binary") {
          column.type = "varbinary";
          column.length = eleDef.length;
        }
        if (eleDef.type === "cds.LargeBinary") {
          column.type = "longblob";
        }
        if (eleDef.type === "cds.LargeString") {
          column.type = "longtext";
        }

        // not association or composition
        if (!["cds.Association", "cds.Composition"].includes(eleDef.type)) {
          const typeOrmColumnConfig = groupByKeyPrefix(eleDef, ANNOTATION_CDS_TYPEORM_CONFIG);
          if (typeOrmColumnConfig !== undefined && Object.keys(typeOrmColumnConfig).length > 0) {
            Object.assign(
              column,
              typeOrmColumnConfig,
            );
          }
        }

      }

    }


    if (length) {
      const long1 = length.real_ulonglong_number();
      if (long1) {
        column.length = parseInt(long1?.text);
      }
      // (5000)
      // default un-set length string,
      // will convert it to 'text' to avoid MySQL row 65565 bytes size limit
      if (
        TextColumnTypes.includes(column.type) &&
        column.length === DEFAULT_STRING_LENGTH) {
        column.type = "text";
        column.length = undefined;
      }
    }
  
    // (10, 2)
    if (floatOption) {
      column.precision = parseInt(floatOption.getChild(0).getChild(1).text);
      column.scale = parseInt(floatOption.getChild(0).getChild(3).text);
    }

    // DEFAULT
    if (attrs && attrs.length > 0) {

      for (const attr of attrs) {

        if (attr.NOT_SYMBOL() && attr.nullLiteral()) {
          column.nullable = false;
          column.default = undefined;
        }

        // is DEFAULT value
        if (attr.DEFAULT_SYMBOL()) {
          const sign = attr.signedLiteral();
          if (sign) {
            const lit = sign.literal();

            let value = undefined;

            if (lit.boolLiteral()) {
              const sBool = lit.boolLiteral().text.toLowerCase().trim();
              if (sBool === "true") {
                value = true;
              }
              if (sBool === "false") {
                value = false;
              }
            }
            if (lit.numLiteral()) {
              value = parseFloat(lit.numLiteral().text);
            }
            if (lit.nullLiteral()) {
              value = null;
            }
            if (lit.textLiteral()) {
              value = trimSuffix(trimPrefix(lit.textLiteral().text, "'"), "'");
            }

            column.default = value;
          }

          const now = attr.NOW_SYMBOL();

          // current_timestamp
          if (now) {
            if (column.type === "date") {
              logger?.debug(
                `column(${column.name}) default value skipped, because mysql not support create 'date' column with default value '${now.text}'`
              );
            } else {
              column.default = () => "CURRENT_TIMESTAMP()";
            }
          }
        }
      }
    }

    this._tmp.columns[column.name] = column;
  }

  private newEntitySchemaOption(): EntitySchemaOptionsWithDeps {
    return { name: "", columns: {}, synchronize: true, deps: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  exitCreateTable(ctx: CreateTableContext) {
    const entityDef = fuzzy.findEntity(this._tmp.name, this._model);
    if (entityDef !== undefined) {
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
        Object.assign(this._tmp, schemaConfig);
      }
      // TODO: check 

    }

    // TODO: why its undefined ?
    this._entities.push(new EntitySchema(this._tmp));
    this._tmp = this.newEntitySchemaOption();
  }

  exitTableConstraintDef(ctx: TableConstraintDefContext) {
    // PRIMARY KEY (COLUMN);
    if (ctx.PRIMARY_SYMBOL() && ctx.KEY_SYMBOL()) {
      const keyList = ctx.keyListVariants().keyList();
      const keyParts = keyList.keyPart();
      keyParts.forEach((keyPart) => {
        this._tmp.columns[keyPart.text].primary = true;
        this._tmp.columns[keyPart.text].nullable = false;
        this._tmp.columns[keyPart.text].default = undefined;
      });
    }
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
      const exp = this._currentStatement.substr(select.start.startIndex, select.stop.stopIndex);
      this._tmp.expression = exp;
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
      // order by graph
      const g = new Graph();
      this._entities.forEach((entity) => {
        const { deps, tableName } = <EntitySchemaOptionsWithDeps>entity.options;
        g.setNode(tableName, entity);
        if (deps && deps.length > 0) {
          // VIEW
          deps.forEach((dep) => g.setEdge(tableName, dep));
        }
      });
      return alg
        .topsort(g)
        .reverse()
        .map((node) => g.node(node));
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

/**
 * convert csn to typeorm entities
 *
 * @param model plain CSN model
 */
export function csnToEntity(model: CSN): Array<EntitySchema> {
  const cds = cwdRequireCDS();
  overwriteCDSCoreTypes();
  // @ts-ignore
  const listener: CDSListener = new CDSListener({ model: cds.compile.for.nodejs(model) });
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
