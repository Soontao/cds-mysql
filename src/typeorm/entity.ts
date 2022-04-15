/* eslint-disable max-len */
import { alg, Graph } from "@newdash/graphlib";
import { trimPrefix, trimSuffix } from "@newdash/newdash";
import MySQLParser, {
  ColumnDefinitionContext,
  CreateTableContext,
  CreateViewContext,
  MySQLParserListener,
  TableConstraintDefContext,
  TableNameContext,
  TableRefContext
} from "ts-mysql-parser";
import { ColumnType, EntitySchema, EntitySchemaColumnOptions } from "typeorm";
import { EntitySchemaOptions } from "typeorm/entity-schema/EntitySchemaOptions";
import { ANNOTATION_CDS_TYPEORM_CONFIG } from "../constants";
import { groupByKey, overwriteCDSCoreTypes } from "../utils";

type TableName = string;

// @ts-ignore
const cds = global.cds || require("@sap/cds/lib");
const logger = cds.log("mysql|db");

const TextColumnTypes: Array<ColumnType> = ["varchar", "varchar2", "nvarchar", "nvarchar2", "char"];

const DEFAULT_LENGTH = 5000;

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

  private _model: any;

  constructor(options: any) {
    this._entities = [];
    this._tmp = this.newEntitySchemaOption();
    this._currentStatement = "";
    this._model = options.model;
  }

  // >> CREATE TABLE

  exitTableName(ctx: TableNameContext) {
    this._tmp.name = ctx.text;
    this._tmp.tableName = ctx.text;
  }

  exitColumnDefinition(ctx: ColumnDefinitionContext) {
    // mapping DDL column definition to schema options
    const name = ctx.columnName();
    const field = ctx.fieldDefinition();
    const dataType = field.dataType();
    const length = dataType.fieldLength();
    const floatOption = dataType.floatOptions();
    const attrs = field.columnAttribute();

    const column: EntitySchemaColumnOptions = {
      name: name.text,
      type: <ColumnType>dataType.getChild(0).text.toLowerCase(),
      nullable: true, // default can be null
      default: null
    };

    // (5000)
    if (length) {
      const long1 = length.real_ulonglong_number();
      if (long1) {
        column.length = parseInt(long1?.text);
      }
      // default un-set length string,
      // will convert it to 'text' to avoid MySQL row 65565 bytes size limit
      if (TextColumnTypes.includes(column.type) && column.length === DEFAULT_LENGTH) {
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
      attrs.forEach((attr) => {
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
              const sBool = lit.boolLiteral().text.toLowerCase();
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
              logger?.warn(
                `column(${column.name}) default value skipped, because mysql not support create 'date' column with default value '${now.text}'`
              );
            } else {
              column.default = () => "CURRENT_TIMESTAMP()";
            }
          }
        }
      });
    }

    this._tmp.columns[name.text] = column;
  }

  private newEntitySchemaOption(): EntitySchemaOptionsWithDeps {
    return { name: "", columns: {}, synchronize: true, deps: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  exitCreateTable(ctx: CreateTableContext) {
    const entityDef = this.findEntityCSN(this._tmp.name);
    if (entityDef !== undefined) {
      const schemaConfig = groupByKey(ANNOTATION_CDS_TYPEORM_CONFIG, entityDef);

      if (schemaConfig !== undefined && Object.keys(schemaConfig).length > 0) {
        this._tmp = Object.assign({}, schemaConfig, this._tmp);
      }

      Object
        .values(entityDef.elements)
        .forEach((elementDef: any) => {
          // TODO: filter composition and association
          const columnName = elementDef.name;
          const columnConfig = groupByKey(ANNOTATION_CDS_TYPEORM_CONFIG, elementDef);
          if (columnConfig !== undefined && Object.keys(columnConfig).length > 0 && columnName in this._tmp.columns) {
            this._tmp.columns[columnName] = Object.assign(
              {},
              columnConfig,
              this._tmp.columns[columnName],
            );
          }
        });

    }

    // TODO: why its undefined ?
    this._entities.push(new EntitySchema(this._tmp));
    this._tmp = this.newEntitySchemaOption();
  }

  private findEntityCSN(tableName: string): any {
    return Object.values(this._model.definitions).find((def: any) => def?.name?.split(".").join("_") === tableName);
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
 * @param model CSN model
 */
export function csnToEntity(model: any): Array<EntitySchema> {
  overwriteCDSCoreTypes();
  const listener: CDSListener = new CDSListener({ model: cds.reflect(model) });
  const parser = new MySQLParser({ parserListener: listener });
  const statements = cds.compile.to.sql(model);
  statements.forEach((stat: string) => {
    stat = stat.replace(/TIMESTAMP_TEXT/g, "TIMESTAMP"); // workaround for TIMESTAMP_TEXT type
    listener.setCurrentStatement(stat);
    const result = parser.parse(stat);
    if (result.lexerError) {
      throw result.lexerError;
    }
    if (result.parserError) {
      throw result.parserError;
    }
  });
  return listener.getEntitySchemas();
}
