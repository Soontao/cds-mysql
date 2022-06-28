import { CustomDeleteBuilder } from "./CustomDeleteBuilder";
import { CustomExpressionBuilder } from "./CustomExpressionBuilder";
import { CustomInsertBuilder } from "./CustomInsertBuilder";
import { CustomReferenceBuilder } from "./CustomReferenceBuilder";
import { CustomSelectBuilder } from "./CustomSelectBuilder";
import { CustomUpdateBuilder } from "./CustomUpdateBuilder";

const dependencies = {
  get InsertBuilder() {
    Object.defineProperty(dependencies, "InsertBuilder", { value: CustomInsertBuilder });
    return CustomInsertBuilder;
  },
  get DeleteBuilder() {
    Object.defineProperty(dependencies, "DeleteBuilder", { value: CustomDeleteBuilder });
    return CustomDeleteBuilder;
  },
  get ExpressionBuilder() {
    Object.defineProperty(dependencies, "ExpressionBuilder", { value: CustomExpressionBuilder });
    return CustomExpressionBuilder;
  },
  get SelectBuilder() {
    Object.defineProperty(dependencies, "SelectBuilder", { value: CustomSelectBuilder });
    return CustomSelectBuilder;
  },
  get ReferenceBuilder() {
    Object.defineProperty(dependencies, "ReferenceBuilder", { value: CustomReferenceBuilder });
    return CustomReferenceBuilder;
  },
  get UpdateBuilder() {
    Object.defineProperty(dependencies, "UpdateBuilder", { value: CustomUpdateBuilder });
    return CustomUpdateBuilder;
  },
};

export default dependencies;
