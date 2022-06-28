import { CSN } from "@sap/cds/apis/csn";
import { SelectBuilder } from "@sap/cds/libx/_runtime/db/sql-builder";
import { Definition } from "cds-internal-tool";
import { CustomExpressionBuilder } from "./CustomExpressionBuilder";
import { CustomFunctionBuilder } from "./CustomFunctionBuilder";
import { CustomReferenceBuilder } from "./CustomReferenceBuilder";
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

export class CustomSelectBuilder extends SelectBuilder {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    // overwrite quote function
    // @ts-ignore
    this._quoteElement = enhancedQuotingStyles[this._quotingStyle];
  }

  get ReferenceBuilder() {
    Object.defineProperty(this, "ReferenceBuilder", { value: CustomReferenceBuilder });
    return CustomReferenceBuilder;
  }

  get ExpressionBuilder() {
    Object.defineProperty(this, "ExpressionBuilder", { value: CustomExpressionBuilder });
    return CustomExpressionBuilder;
  }

  get FunctionBuilder() {
    Object.defineProperty(this, "FunctionBuilder", { value: CustomFunctionBuilder });
    return CustomFunctionBuilder;
  }

  get SelectBuilder() {
    Object.defineProperty(this, "SelectBuilder", { value: CustomSelectBuilder });
    return CustomSelectBuilder;
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
