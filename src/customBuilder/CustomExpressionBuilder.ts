import { CSN, cwdRequire } from "cds-internal-tool";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

const { ExpressionBuilder } = cwdRequire("@sap/cds/libx/_runtime/db/sql-builder");


export class CustomExpressionBuilder extends ExpressionBuilder {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    // overwrite quote function
    this._quoteElement = enhancedQuotingStyles.plain;
  }

  build() {
    // REVISIT: try to remove this later, maybe has already been fixed by cds runtime
    // fix upper case DRAFTS table issue
    if (
      this._obj?.xpr instanceof Array &&
      this._obj?.xpr?.[2] === "drafts.DraftAdministrativeData_DraftUUID"
    ) {
      this._obj.xpr[2] = { ref: ["drafts", "DraftAdministrativeData_DraftUUID"] };
    }
    return super.build();
  }

};
