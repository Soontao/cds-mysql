import { ExpressionBuilder } from "@sap/cds/libx/_runtime/db/sql-builder";
import type { CSN } from "cds-internal-tool";
import { CustomFunctionBuilder } from "./CustomFunctionBuilder";
import { CustomReferenceBuilder } from "./CustomReferenceBuilder";
import { CustomSelectBuilder } from "./CustomSelectBuilder";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

export class CustomExpressionBuilder extends ExpressionBuilder {
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

  get SelectBuilder() {
    Object.defineProperty(this, "SelectBuilder", { value: CustomSelectBuilder });
    return CustomSelectBuilder;
  }

  get FunctionBuilder() {
    Object.defineProperty(this, "FunctionBuilder", { value: CustomFunctionBuilder });
    return CustomFunctionBuilder;
  }

};
