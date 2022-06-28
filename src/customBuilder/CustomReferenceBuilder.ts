import { CSN } from "@sap/cds/apis/csn";
import { ReferenceBuilder } from "@sap/cds/libx/_runtime/db/sql-builder";
import { CustomFunctionBuilder } from "./CustomFunctionBuilder";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

export class CustomReferenceBuilder extends ReferenceBuilder {
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
