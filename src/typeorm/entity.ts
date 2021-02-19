import { trimPrefix, trimSuffix } from "@newdash/newdash";
import cds from "@sap/cds";
import { CSN } from "@sap/cds-reflect/apis/csn";
import MySQLParser, { ColumnDefinitionContext, CreateTableContext, MySQLParserListener, TableConstraintDefContext, TableNameContext } from "ts-mysql-parser";
import { EntitySchema } from "typeorm";
import { EntitySchemaOptions } from "typeorm/entity-schema/EntitySchemaOptions";

class CDSListener implements MySQLParserListener {

  private _entities: Array<EntitySchema>;
  private _tmp: EntitySchemaOptions<any>;

  constructor() {
    this._entities = [];
    this._tmp = { name: "", columns: {} };
  }


  exitTableName(ctx: TableNameContext) {
    this._tmp.name = ctx.text;
    this._tmp.tableName = ctx.text;
  }

  exitColumnDefinition(ctx: ColumnDefinitionContext) {
    const name = ctx.columnName();
    const field = ctx.fieldDefinition();
    const dataType = field.dataType();
    const length = dataType.fieldLength();
    const floatOption = dataType.floatOptions();
    const attrs = field.columnAttribute();

    this._tmp.columns[name.text] = {
      name: name.text,
      // @ts-ignore
      type: dataType.getChild(0).text.toLowerCase()
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

        }

        if (attr.NOT_SYMBOL() && attr.nullLiteral()) {
          this._tmp.columns[name.text]["nullable"] = false;
        }

      });
    }

  }

  exitCreateTable(ctx: CreateTableContext) {
    this._entities.push(new EntitySchema(this._tmp));
    this._tmp = { name: "", columns: {} };
  }

  // exitCreateView(ctx: CreateViewContext) {
  //   const viewName = ctx.viewName();
  //   const select = ctx.viewTail()?.viewSelect();
  //   if (viewName && select) {
  //     this._tmp.type = "view";
  //     this._tmp.name = viewName.text;
  //     this._tmp.expression = select.text;
  //   }
  //   this._entities.push(new EntitySchema(this._tmp));
  //   this._tmp = { name: "", columns: {} };
  // }

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

  public getTables() {
    return this._entities;
  }
}

const isCreateView = (stat: string) => {
  const [, tableOrView] = stat.match(/^\s*CREATE (?:(TABLE|VIEW))\s+"?([^\s(]+)"?/im) || [];
  return tableOrView?.toLowerCase() == "view";
};


/**
 * convert csn to typeorm entities
 * 
 * @param model 
 */
export function csnToEntity(model: CSN): Array<EntitySchema> {
  const listener: CDSListener = new CDSListener();
  const parser = new MySQLParser({ parserListener: listener });
  const statements = cds.compile.to.sql(model);
  statements.forEach(stat => parser.parse(stat));
  return listener.getTables();
}