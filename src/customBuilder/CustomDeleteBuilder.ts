// @ts-nocheck
import { CSN } from "@sap/cds/apis/csn";
import DeleteBuilder from "@sap/cds/libx/_runtime/db/sql-builder/DeleteBuilder";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

export = class CustomDeleteBuilder extends DeleteBuilder {

  _outputObj: any;

  _obj: any;

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
