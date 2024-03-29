import { CSN, cwdRequire, cwdRequireCDS, Definition } from "cds-internal-tool";
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

  /**
   * @see https://dev.mysql.com/doc/refman/5.6/en/innodb-locking-reads.html
   */
  _forUpdate() {
    this._outputObj.sql.push("FOR UPDATE");
    if (this._obj.SELECT.forUpdate.wait !== undefined) {
      cwdRequireCDS().log("ql").warn("cds-mysql do not support 'wait' parameter of forUpdate");
    }
  }

  /**
   * @see https://dev.mysql.com/doc/refman/5.6/en/innodb-locking-reads.html
   */
  _forShareLock() {
    this._outputObj.sql.push("LOCK IN SHARE MODE");
  }

  _fromElement(element: Definition, parent: any, i = 0) {
    // avoid: ER_DERIVED_MUST_HAVE_ALIAS of mysql database 
    // (double brackets without alias for inner table)

    // only the element is sub query, add the alias
    if (parent === undefined && typeof element.SELECT === "object") {
      super._fromElement(element, parent, i);
      if (element.SELECT?.from?.as === undefined) {
        this._outputObj.sql.push("AS", this._quoteElement(`t_${nextTmpNumber()}`));
      }
      else {
        this._outputObj.sql.push("AS", this._quoteElement(element.SELECT?.from?.as));
      }
      return;
    }

    return super._fromElement(element, parent, i);

  }
};
