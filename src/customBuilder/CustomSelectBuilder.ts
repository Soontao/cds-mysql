import { SelectBuilder } from "@sap/cds-runtime/lib/db/sql-builder";

export = class CustomSelectBuilder extends SelectBuilder {

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
  get FunctionBuilder() {
    const FunctionBuilder = require("./CustomFunctionBuilder");
    Object.defineProperty(this, "FunctionBuilder", { value: FunctionBuilder });
    return FunctionBuilder;
  }

  getCollate() {
    return "COLLATE " + this.getCollatingSequence();
  }

  getCollatingSequence() {
    return "utf8_general_ci";
  }

  _forUpdate() { }
}

