import { CSN } from "@sap/cds/apis/csn";
import { SelectBuilder } from "@sap/cds/libx/_runtime/db/sql-builder";
import { Definition } from "cds-internal-tool";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

/**
 * create tmp number
 * @returns 
 */
function nextTmpNumber() {
  let tmp = nextTmpNumber?.tmp ?? 0;
  tmp += 1;
  tmp = tmp % 10000;
  nextTmpNumber.tmp = tmp;
  return tmp;
}

nextTmpNumber.tmp = 0;

export = class CustomSelectBuilder extends SelectBuilder {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    // overwrite quote function
    // @ts-ignore
    this._quoteElement = enhancedQuotingStyles[this._quotingStyle];
  }

  get ReferenceBuilder() {
    const ReferenceBuilder = require("./CustomReferenceBuilder");
    Object.defineProperty(this, "ReferenceBuilder", { value: ReferenceBuilder });
    return ReferenceBuilder;
  }

  get ExpressionBuilder() {
    const ExpressionBuilder = require("./CustomExpressionBuilder");
    Object.defineProperty(this, "ExpressionBuilder", { value: ExpressionBuilder });
    return ExpressionBuilder;
  }

  get FunctionBuilder() {
    const FunctionBuilder = require("./CustomFunctionBuilder");
    Object.defineProperty(this, "FunctionBuilder", { value: FunctionBuilder });
    return FunctionBuilder;
  }

  get SelectBuilder() {
    const SelectBuilder = require("./CustomSelectBuilder");
    Object.defineProperty(this, "SelectBuilder", { value: SelectBuilder });
    return SelectBuilder;
  }

  _forUpdate() { }

  _fromElement(element: Definition, parent: any, i = 0) {
    // avoid: ER_DERIVED_MUST_HAVE_ALIAS of mysql database 
    // (double brackets without alias for inner table)
    if (element.as === undefined && parent === undefined) {
      return super._fromElement(
        { ...element, as: `tmp_table_${nextTmpNumber()}` },
        parent,
        i
      );
    }
    return super._fromElement(element, parent, i);
  }
};
