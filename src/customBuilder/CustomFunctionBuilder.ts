// @ts-nocheck
import { CSN } from "@sap/cds/apis/csn";
import { FunctionBuilder } from "@sap/cds/libx/_runtime/db/sql-builder";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

const dateTimePlaceHolder = new Map([
  ["year", "'%Y'"],
  ["month", "'%m'"],
  ["dayofmonth", "'%d'"],
  ["second", "'%f'"],
  ["hour", "'%H'"],
  ["minute", "'%M'"]
]);

const standardFunctions = ["locate", "substring", "to_date", "to_time"];

export = class CustomFunctionBuilder extends FunctionBuilder {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    // overwrite quote function
    // @ts-ignore
    this._quoteElement = enhancedQuotingStyles[this._quotingStyle];
  }
  get ExpressionBuilder() {
    const ExpressionBuilder = require("./CustomExpressionBuilder");
    Object.defineProperty(this, "ExpressionBuilder", { value: ExpressionBuilder });
    return ExpressionBuilder;
  }

  get ReferenceBuilder() {
    const ReferenceBuilder = require("./CustomReferenceBuilder");
    Object.defineProperty(this, "ReferenceBuilder", { value: ReferenceBuilder });
    return ReferenceBuilder;
  }

  get SelectBuilder() {
    const SelectBuilder = require("./CustomSelectBuilder");
    Object.defineProperty(this, "SelectBuilder", { value: SelectBuilder });
    return SelectBuilder;
  }

  _handleFunction() {
    const functionName = this._functionName();
    const args = this._functionArgs();

    if (dateTimePlaceHolder.has(functionName)) {
      this._timeFunction(functionName, args);
    } else if (standardFunctions.includes(functionName)) {
      this._standardFunction(functionName, args);
    } else if (functionName === "seconds_between") {
      this._secondsBetweenFunction(args);
    } else {
      super._handleFunction();
    }
  }

  _handleContains(args) {
    this._handleLikewiseFunc(args);
  }

  _createLikeComparisonForColumn(not, left, right) {
    if (not) {
      this._outputObj.sql.push("(", left, "IS NULL", "OR");
    }

    this._outputObj.sql.push(left, `${not}LIKE`);
    this._outputObj.sql.push("CONCAT"); // CONCAT ('%', ?, '%')
    this._addFunctionArgs(right, true);
    if (not) this._outputObj.sql.push(")");
  }

  _standardFunction(functionName, args) {
    switch (functionName) {
      case "locate":
        functionName = "INSTR";
        break;
      case "substring":
        functionName = "substr";
        break;
      case "to_date":
        functionName = "date";
        break;
      case "to_time":
        functionName = "time";
        break;
      default:
        break;
    }

    this._outputObj.sql.push(functionName, "(");
    if (typeof args === "string") {
      this._outputObj.sql.push(args, ")");
    } else {
      this._addFunctionArgs(args);
      this._outputObj.sql.push(")");
    }
  }

  _handleConcat(args) {
    const res = [];
    for (const arg of args) {
      if (arg.ref) {
        const { sql, values } = new this.ReferenceBuilder(arg, this._options, this._csn).build();
        res.push(sql);
        this._outputObj.values.push(...values);
      } else if (arg.val) {
        if (typeof arg.val === "number") {
          res.push(arg.val);
        } else {
          this._outputObj.values.push(arg.val);
          res.push(this._options.placeholder);
        }
      } else if (typeof arg === "string") {
        res.push(arg);
      } else if (arg.func) {
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

  _val(val) {
    this._outputObj.sql.push("?");
    this._outputObj.values.push(val);
  }

  _ref(ref) {
    this._outputObj.sql.push(new this.ReferenceBuilder(ref, this._options, this._csn).build().sql);
  }

  _secondsBetweenFunction(args) {
    this._outputObj.sql.push("DATE_FORMAT(");
    if (args[1].val) {
      this._val(args[1].val);
    } else {
      this._ref(args[1]);
    }
    this._outputObj.values.push("%s");
    this._outputObj.sql.push(",?) - DATE_FORMAT(");
    if (args[0].val) {
      this._val(args[0].val);
    } else {
      this._ref(args[0]);
    }
    this._outputObj.values.push("%s");
    this._outputObj.sql.push(",?)");
  }

  _timeFunction(functionName, args) {
    this._outputObj.sql.push("DATE_FORMAT(");
    if (typeof args === "string") {
      this._outputObj.sql.push(args);
    } else {
      this._addFunctionArgs(args);
    }
    this._outputObj.sql.push(",", dateTimePlaceHolder.get(functionName));
    this._outputObj.sql.push(")");
  }
};
