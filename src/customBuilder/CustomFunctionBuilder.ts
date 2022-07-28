// @ts-nocheck
import { FunctionBuilder } from "@sap/cds/libx/_runtime/db/sql-builder";
import type { CSN } from "cds-internal-tool";
import { func, ref, val } from "cds-internal-tool/lib/types/cxn";
import { CustomExpressionBuilder } from "./CustomExpressionBuilder";
import { CustomReferenceBuilder } from "./CustomReferenceBuilder";
import { CustomSelectBuilder } from "./CustomSelectBuilder";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

const dateTimePlaceHolder = new Map([
  ["year", "'%Y'"],
  ["month", "'%m'"],
  ["dayofmonth", "'%d'"],
  ["second", "'%f'"],
  ["hour", "'%H'"],
  ["minute", "'%M'"]
]);

const STANDARD_FUNCTIONS = new Map([
  ["locate", "INSTR"],
  ["substring", "SUBSTR"],
  ["to_date", "DATE"],
  ["to_time", "TIME"],
]);

export class CustomFunctionBuilder extends FunctionBuilder {

  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    this._quoteElement = enhancedQuotingStyles[this._quotingStyle];
  }

  get ExpressionBuilder() {
    Object.defineProperty(this, "ExpressionBuilder", { value: CustomExpressionBuilder });
    return CustomExpressionBuilder;
  }

  get ReferenceBuilder() {
    Object.defineProperty(this, "ReferenceBuilder", { value: CustomReferenceBuilder });
    return CustomReferenceBuilder;
  }

  get SelectBuilder() {
    Object.defineProperty(this, "SelectBuilder", { value: CustomSelectBuilder });
    return CustomSelectBuilder;
  }

  public build() {
    this._outputObj = { sql: [], values: [] };
    this._handleFunction();
    // SELECT count ( 1 ) AS "total" FROM People ALIAS_1:
    // ERROR: FUNCTION cds_admin.count does not exist in: 
    // TiDB will throw error: SELECT count ( 1 );
    this._outputObj.sql = this._outputObj.sql.join(""); // overwrite standard ' ', to adapt the TiDB
    return this._outputObj;
  }

  private _handleFunction() {
    const functionName = this._functionName();
    const args = this._functionArgs(); ``;

    if (dateTimePlaceHolder.has(functionName)) {
      this._timeFunction(functionName, args);
    }
    else if (STANDARD_FUNCTIONS.has(functionName)) {
      this._standardFunction(functionName, args);
    }
    else if (functionName === "concat") {
      this._handleConcat(args);
    }
    else {
      super._handleFunction();
    }
  }

  _handleContains(args) {
    this._handleLikewiseFunc(args);
  }

  _createLikeComparisonForColumn(not, left, right) {
    if (not) {
      this._outputObj.sql.push("(", " ", left, " ", "IS NULL", " ", "OR", " ");
    }

    this._outputObj.sql.push(left, " ", `${not} LIKE`, " ");
    this._outputObj.sql.push("CONCAT"); // CONCAT ('%', ?, '%')
    this._addFunctionArgs(right, true);
    if (not) this._outputObj.sql.push(")");
  }

  private _standardFunction(functionName: string, args: string | Array<any>) {
    this._outputObj.sql.push(STANDARD_FUNCTIONS.get(functionName), "(");
    if (typeof args === "string") {
      this._outputObj.sql.push(args, ")");
    }
    else {
      this._addFunctionArgs(args);
      this._outputObj.sql.push(")");
    }
  }

  private _handleConcat(args: Array<ref | val | func | string>) {
    const res = [];
    for (const arg of args) {
      if (arg.ref) {
        const { sql, values } = new this.ReferenceBuilder(arg, this._options, this._csn).build();
        res.push(sql);
        this._outputObj.values.push(...values);
      }
      else if (arg.val) {
        if (typeof arg.val === "number") {
          res.push(arg.val);
        }
        else {
          this._outputObj.values.push(arg.val);
          res.push(this._options.placeholder);
        }
      }
      else if (typeof arg === "string") {
        res.push(arg);
      }
      else if (arg.func) {
        const { sql, values } = new FunctionBuilder(arg, this._options, this._csn).build();
        res.push(sql);
        this._outputObj.values.push(...values);
      }
    }
    // MySQL support concat multi values
    this._outputObj.sql.push("CONCAT(");
    this._outputObj.sql.push(res.join(", "));
    this._outputObj.sql.push(")");
  }

  _timeFunction(functionName: string, args: string | Array<any>) {
    this._outputObj.sql.push("DATE_FORMAT(");
    if (typeof args === "string") {
      this._outputObj.sql.push(args);
    }
    else {
      this._addFunctionArgs(args);
    }
    this._outputObj.sql.push(",", dateTimePlaceHolder.get(functionName));
    this._outputObj.sql.push(")");
  }
};
