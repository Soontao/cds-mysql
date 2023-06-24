import { CSN, cwdRequire } from "cds-internal-tool";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

const { ExpressionBuilder } = cwdRequire("@sap/cds/libx/_runtime/db/sql-builder");


export class CustomExpressionBuilder extends ExpressionBuilder {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    // overwrite quote function
    this._quoteElement = enhancedQuotingStyles.plain;
  }
};
