import { trimPrefix, trimSuffix } from "@newdash/newdash";
import cds from "@sap/cds";
import { alg, Graph } from "graphlib";
import MySQLParser, { ColumnDefinitionContext, CreateTableContext, CreateViewContext, MySQLParserListener, TableConstraintDefContext, TableNameContext, TableRefContext } from "ts-mysql-parser";
import { EntitySchema } from "typeorm";
import { EntitySchemaOptions } from "typeorm/entity-schema/EntitySchemaOptions";

type TableName = string;

interface EntitySchemaOptionsWithDeps extends EntitySchemaOptions<any> {
  /**
   * this view/table maybe depends other view/tables
   */
  deps: TableName[]
}

class CDSListener implements MySQLParserListener {

  private _entities: Array<EntitySchema>;
  private _tmp: EntitySchemaOptionsWithDeps;
  private _currentStatement: string;

  constructor() {
    this._entities = [];
    this._tmp = this.newEntitySchemaOption();
    this._currentStatement = "";
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

    this._tmp.columns[name.text] = {
      name: name.text,
      // @ts-ignore
      type: dataType.getChild(0).text.toLowerCase(),
      nullable: true, // default can be null
    };

    if (length) {
      const long1 = length.real_ulonglong_number();
      if (long1) {
        this._tmp.columns[name.text]["length"] = parseInt(long1?.text);
      }
    }
    if (floatOption) {
      this._tmp.columns[name.text]["precision"] = parseInt(floatOption.getChild(0).getChild(1).text);
      this._tmp.columns[name.text]["scale"] = parseInt(floatOption.getChild(0).getChild(3).text);
    }

    if (attrs && attrs.length > 0) {
      attrs.forEach(attr => {
        // is DEFAULT value
        if (attr.DEFAULT_SYMBOL()) {
          const sign = attr.signedLiteral();
          if (sign) {

            const lit = sign.literal();

            let value = undefined;

            if (lit.boolLiteral()) {
              value = Boolean(lit.boolLiteral());
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

            this._tmp.columns[name.text]["default"] = value;

          }

          // current_timestamp
          if (attr.NOW_SYMBOL()) {
            const now = attr.NOW_SYMBOL();
            this._tmp.columns[name.text]["default"] = () => now.text;
          }

        }

        if (attr.NOT_SYMBOL() && attr.nullLiteral()) {
          this._tmp.columns[name.text]["nullable"] = false;
        }

      });
    }

  }

  private newEntitySchemaOption(): EntitySchemaOptionsWithDeps {
    return { name: "", columns: {}, synchronize: true, deps: [] };
  }

  exitCreateTable(ctx: CreateTableContext) {
    this._entities.push(new EntitySchema(this._tmp));
    this._tmp = this.newEntitySchemaOption();
  }


  exitTableConstraintDef(ctx: TableConstraintDefContext) {
    // PRIMARY KEY (COLUMN);
    if (ctx.PRIMARY_SYMBOL() && ctx.KEY_SYMBOL()) {
      const keyList = ctx.keyListVariants().keyList();
      const keyParts = keyList.keyPart();
      keyParts.forEach(keyPart => {
        this._tmp.columns[keyPart.text].primary = true;
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
      this._entities.forEach(entity => {
        const { deps, tableName } = (<EntitySchemaOptionsWithDeps>entity.options);
        g.setNode(tableName, entity);
        if (deps && deps.length > 0) {
          // VIEW
          deps.forEach(dep => g.setEdge(tableName, dep));
        }
      });
      return alg.topsort(g).reverse().map(node => g.node(node));
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
  const listener: CDSListener = new CDSListener();
  const parser = new MySQLParser({ parserListener: listener });
  const statements = cds.compile.to.sql(model);
  statements.forEach(stat => {
    listener.setCurrentStatement(stat);
    parser.parse(stat);
  });
  return listener.getEntitySchemas();
}