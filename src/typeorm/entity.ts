import cds from "@sap/cds";
import { CSN } from "@sap/cds/apis/csn";
import MySQLParser, { ColumnDefinitionContext, ColumnNameContext, CreateTableContext, DataTypeContext, FieldDefinitionContext, FieldLengthContext, FloatOptionsContext, MySQLParserListener, Real_ulonglong_numberContext, Real_ulong_numberContext, TableNameContext } from "ts-mysql-parser";
import { EntitySchema } from "typeorm";
import { EntitySchemaOptions } from "typeorm/entity-schema/EntitySchemaOptions";

const cdsToSqlTypes = {
  "cds.String": "NVARCHAR",
  "cds.hana.NCHAR": "NCHAR",
  "cds.LargeString": "NCLOB",
  "cds.hana.VARCHAR": "VARCHAR",
  "cds.hana.CHAR": "CHAR",
  "cds.hana.CLOB": "CLOB",
  "cds.Binary": "BLOB",
  "cds.hana.BINARY": "BLOB",
  "cds.LargeBinary": "BLOB",
  "cds.Decimal": "DECIMAL",
  "cds.DecimalFloat": "DECIMAL",
  "cds.Integer64": "BIGINT",
  "cds.Integer": "INTEGER",
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
  "cds.hana.SMALLDECIMAL": "DECIMAL",
  "cds.hana.ST_POINT": "ST_POINT",
  "cds.hana.ST_GEOMETRY": "ST_GEOMETRY"
};

const IGNORE_TYPES = ["cds.Composition", "cds.Association"];

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

    const name = ctx.getRuleContext(0, ColumnNameContext);
    const field = ctx.getRuleContext(0, FieldDefinitionContext);
    const dataType = field.getRuleContext(0, DataTypeContext);
    const length = dataType.tryGetRuleContext(0, FieldLengthContext);
    const floatOption = dataType.tryGetRuleContext(0, FloatOptionsContext);

    this._tmp.columns[name.text] = {
      name: name.text,
      // @ts-ignore
      type: dataType.getChild(0).text.toLowerCase()
    };

    if (length) {
      const long1 = length.tryGetRuleContext(0, Real_ulonglong_numberContext);
      const long2 = length.tryGetRuleContext(0, Real_ulong_numberContext);
      if (long1 || long2) {
        this._tmp.columns[name.text]["length"] = parseInt(long1?.text ?? long2?.text);
      }
    }
    if (floatOption) {
      this._tmp.columns[name.text]["precision"] = parseInt(floatOption.getChild(0).getChild(1).text);
      this._tmp.columns[name.text]["scale"] = parseInt(floatOption.getChild(0).getChild(3).text);
    }

  }

  exitCreateTable(ctx: CreateTableContext) {
    this._entities.push(new EntitySchema(this._tmp));
    this._tmp = { name: "", columns: {} };
  }


  public getTables() {
    return this._entities;
  }
}


export function csnToEntity(model: CSN): Array<EntitySchema> {
  const listener: CDSListener = new CDSListener();
  const parser = new MySQLParser({ parserListener: listener });
  const statements = cds.compile.to.sql(model);
  statements.forEach(stat => parser.parse(stat));
  return listener.getTables();
}