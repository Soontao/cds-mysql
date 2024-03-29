import { CSN, cwdRequire } from "cds-internal-tool";
import { func, ref, val } from "cds-internal-tool/lib/types/cxn";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

const { FunctionBuilder } = cwdRequire("@sap/cds/libx/_runtime/db/sql-builder");

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
    // overwrite quote function
    this._quoteElement = enhancedQuotingStyles.plain;
  }

  _handleFunction() {
    const functionName = this._functionName();
    const args = this._functionArgs();

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

  _handleCountdistinct(args) {
    // without this, there is no space between 'distinct' keyword and key fields
    this._outputObj.sql.push("count", "(", "DISTINCT", " ");
    if (typeof args === "string") this._outputObj.sql.push(args);
    else this._addFunctionArgs(args);
    this._outputObj.sql.push(")");
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

  private _handleConcat(args: Array<ref | val | func | string | any>) {
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
