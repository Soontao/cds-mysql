import { CSN, cwdRequire, EntityDefinition, fuzzy } from "cds-internal-tool";
import { PRE_CONVERSION_MAP } from "../conversion-pre";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

const { InsertBuilder } = cwdRequire("@sap/cds/libx/_runtime/db/sql-builder");

export class CustomInsertBuilder extends InsertBuilder {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    this._quoteElement = enhancedQuotingStyles[this._quotingStyle];
  }

  private _extOutputObj = { columns: [] };

  public build() {
    this._extOutputObj = { columns: [] };
    super.build();
    // for upsert
    if (this._obj?.INSERT?._upsert === true) {
      // replace insert keyword
      this._outputObj.sql = [
        this._outputObj.sql,
        " ",
        "ON DUPLICATE KEY UPDATE",
        " ",
        this._extOutputObj.columns.map(
          col => `${this._quoteElement(col)} = VALUES(${this._quoteElement(col)})`
        ).join(", ")
      ].join("");
    }
    return this._outputObj;
  }

  /**
   * @mysql
   * 
   * @param column 
   * @param options 
   * @returns 
   */
  private _getValue(
    column: string,
    options: { entry: any, flattenColumn: Array<string>, insertAnnotatedColumns: Map<any, any> }
  ) {
    const val = super._getValue(column, options);
    const columnType = this._entity?.elements?.[column]?.type;
    if (columnType !== undefined && !options.insertAnnotatedColumns.has(column) && PRE_CONVERSION_MAP.has(columnType)) {
      const transformFunc = PRE_CONVERSION_MAP.get(columnType);
      return transformFunc(val);
    }
    return val;
  }

  /**
   * get current CQN entity name
   */
  private get _entityName(): string | undefined {
    if (typeof this._obj?.INSERT?.into === "string") {
      return this._obj?.INSERT?.into;
    }
    if (this._obj?.INSERT?.into?.ref instanceof Array) {
      return this._obj?.INSERT?.into?.ref?.[0];
    }
    return this._obj?.INSERT?.into?.name;
  }

  /**
   * @mysql
   * 
   * get current CQN entity definition
   */
  private get _entity(): EntityDefinition | undefined {
    return fuzzy.findEntity(this._entityName, this._csn);
  }

  /**
   * 
   * @mysql
   * @param columns 
   * @param placeholderNum 
   * @param valuesAndSQLs 
   * @returns 
   */
  protected _entriesSqlString(columns, placeholderNum, valuesAndSQLs) {
    this._extOutputObj.columns.push(...columns);
    return super._entriesSqlString(columns, placeholderNum, valuesAndSQLs);
  }

  /**
   * 
   * @mysql
   * @param annotatedColumns 
   */
  protected _columns(annotatedColumns) {
    this._outputObj.sql.push("(");

    const insertColumns = [...this._obj.INSERT.columns.map((col) => this._quoteElement(col))];

    if (this.uuidKeys) {
      for (const key of this.uuidKeys) {
        if (!this._obj.INSERT.columns.includes(key)) {
          insertColumns.unshift(this._quoteElement(key));
        }
      }
    }

    // for mysql here changed
    this._extOutputObj.columns.push(...insertColumns);
    this._outputObj.sql.push(insertColumns.join(", "));

    if (annotatedColumns) {
      // add insert annotated columns
      this._columnAnnotatedAdded(annotatedColumns);
    }

    this._outputObj.sql.push(")");
  }

  /**
   * @mysql
   * 
   * @returns 
   */
  protected _createPlaceholderString() {
    // for mysql driver, it will automatically processing single & multiply insert
    return ["VALUES", "?"];
  }
};
