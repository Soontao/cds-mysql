import { CSN, cwdRequire, cwdRequireCDS, Definition } from "cds-internal-tool";
import { CustomExpressionBuilder } from "./CustomExpressionBuilder";
import { CustomFunctionBuilder } from "./CustomFunctionBuilder";
import { CustomReferenceBuilder } from "./CustomReferenceBuilder";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

const { SelectBuilder } = cwdRequire("@sap/cds/libx/_runtime/db/sql-builder");


/**
 * create tmp number
 * 
 * @internal
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

export class CustomSelectBuilder extends (SelectBuilder as any) {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    // overwrite quote function
    this._quoteElement = enhancedQuotingStyles.plain;
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

  /**
   * @see [Locking Reads](https://dev.mysql.com/doc/refman/5.6/en/innodb-locking-reads.html)
   */
  _forUpdate() {
    this._outputObj.sql.push("FOR UPDATE");
    if (this._obj.SELECT.forUpdate.wait !== undefined) {
      cwdRequireCDS().log("ql").warn("cds-mysql do not support 'wait' parameter of forUpdate");
    }
  }

  /**
   * @see [Locking Reads](https://dev.mysql.com/doc/refman/5.6/en/innodb-locking-reads.html)
   */
  _forShareLock() {
    this._outputObj.sql.push("LOCK IN SHARE MODE");
  }

  _fromElement(element: Definition, parent: any, i = 0) {
    // avoid: ER_DERIVED_MUST_HAVE_ALIAS of mysql database 
    // (double brackets without alias for inner table)

    if (parent !== undefined && typeof parent.join === "string" && parent.args instanceof Array) {
      for (const expr of parent.args) {
        if (typeof expr.SELECT === "object" && expr.SELECT?.from?.as === undefined) {
          expr.SELECT.from.as = `t_${nextTmpNumber()}`;
        }
      }
    }

    return super._fromElement(element, parent, i);
  }
};
