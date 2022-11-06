import { CSN, cwdRequire } from "cds-internal-tool";
import { CustomFunctionBuilder } from "./CustomFunctionBuilder";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";
const { ReferenceBuilder } = cwdRequire("@sap/cds/libx/_runtime/db/sql-builder");

export class CustomReferenceBuilder extends (ReferenceBuilder as any) {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    // overwrite quote function
    // @ts-ignore
    this._quoteElement = enhancedQuotingStyles[this._quotingStyle];
  }

  get FunctionBuilder() {
    Object.defineProperty(this, "FunctionBuilder", { value: CustomFunctionBuilder });
    return CustomFunctionBuilder;
  }
};
