import { CSN, cwdRequire } from "cds-internal-tool";
import { CustomExpressionBuilder } from "./CustomExpressionBuilder";
import { CustomReferenceBuilder } from "./CustomReferenceBuilder";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

const { DeleteBuilder } = cwdRequire("@sap/cds/libx/_runtime/db/sql-builder");

export class CustomDeleteBuilder extends DeleteBuilder {

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

  _from() {
    if (this._obj.DELETE.from.ref && this._obj.DELETE.from.as) {

      // ref: https://dev.mysql.com/doc/refman/5.6/en/delete.html
      // If you declare an alias for a table, you must use the alias when referring to the table:
      // DELETE t1 FROM test AS t1, test2 WHERE ...

      if (this._obj.DELETE.from.as) {
        this._outputObj.sql.push(this._quoteElement(this._obj.DELETE.from.as));
      }
      this._outputObj.sql.push("FROM");
      const dbName = this._getDatabaseName(this._obj.DELETE.from.ref[0]);
      this._outputObj.sql.push(this._quoteElement(dbName));
      this._options.entityName = this._obj.DELETE.from.ref[0];
      if (this._obj.DELETE.from.as) {
        this._outputObj.sql.push("as", this._quoteElement(this._obj.DELETE.from.as));
      }
    }
    else {
      return super._from();
    }
  }
};
