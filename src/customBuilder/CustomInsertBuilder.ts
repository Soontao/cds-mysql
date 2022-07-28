// @ts-nocheck
import { InsertBuilder } from "@sap/cds/libx/_runtime/db/sql-builder";
import type { CSN, EntityDefinition } from "cds-internal-tool";
import { PRE_CONVERSION_MAP } from "../conversion-pre";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

export class CustomInsertBuilder extends InsertBuilder {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    this._quoteElement = enhancedQuotingStyles[this._quotingStyle];
  }

  private _extOutputObj = {
    columns: [],
  };

  public build() {
    this._extOutputObj = { columns: [] };
    super.build();
    this._transform();
    return this._outputObj;
  }

  /**
   * do datatype transform for mysql
   * 
   * @mysql
   */
  private _transform() {
    const entity = this._entity;
    if (entity !== undefined) {
      this._extOutputObj.columns.forEach((elementName: string, elementIndex: number) => {
        const columnType = entity?.elements?.[elementName]?.type;
        // if column type is needed for transformation
        if (columnType !== undefined && PRE_CONVERSION_MAP.has(columnType)) {
          const transformFunc = PRE_CONVERSION_MAP.get(columnType);
          // guard against undefined
          if (this._outputObj.values instanceof Array) {
            for (const row of this._outputObj.values) {
              row[elementIndex] = transformFunc(row[elementIndex]);
            }
          }
        }
      });
    }
  }

  /**
   * get current CQN entity name
   */
  private get _entityName(): string | undefined {
    if (typeof this._obj?.INSERT?.into === "string") {
      return this._obj?.INSERT?.into;
    }
    if (typeof this._obj?.INSERT?.into?.ref === "object") {
      return this._obj?.INSERT?.into?.ref?.[0];
    }
    return this._obj?.INSERT?.into?.name;
  }

  /**
 * get current CQN entity definition
 */
  private get _entity(): EntityDefinition | undefined {
    return this._csn?.definitions?.[this._entityName];
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
