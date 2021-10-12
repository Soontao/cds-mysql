import { CSN } from "@sap/cds/apis/csn";
import { ExpressionBuilder } from "@sap/cds/libx/_runtime/db/sql-builder";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

export = class CustomExpressionBuilder extends ExpressionBuilder {
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

  get SelectBuilder() {
    const SelectBuilder = require("./CustomSelectBuilder");
    Object.defineProperty(this, "SelectBuilder", { value: SelectBuilder });
    return SelectBuilder;
  }

  get FunctionBuilder() {
    const FunctionBuilder = require("./CustomFunctionBuilder");
    Object.defineProperty(this, "FunctionBuilder", { value: FunctionBuilder });
    return FunctionBuilder;
  }
};
