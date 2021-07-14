import { ReferenceBuilder } from "@sap/cds/libx/_runtime/db/sql-builder";

export = class CustomReferenceBuilder extends ReferenceBuilder {
  get FunctionBuilder() {
    const FunctionBuilder = require("./CustomFunctionBuilder");
    Object.defineProperty(this, "FunctionBuilder", { value: FunctionBuilder });
    return FunctionBuilder;
  }
}
