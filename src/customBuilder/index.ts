import { CustomDeleteBuilder as DeleteBuilder } from "./CustomDeleteBuilder";
import { CustomExpressionBuilder as ExpressionBuilder } from "./CustomExpressionBuilder";
import { CustomInsertBuilder as InsertBuilder } from "./CustomInsertBuilder";
import { CustomFunctionBuilder as FunctionBuilder } from "./CustomFunctionBuilder";
import { CustomReferenceBuilder as ReferenceBuilder } from "./CustomReferenceBuilder";
import { CustomSelectBuilder as SelectBuilder } from "./CustomSelectBuilder";
import { CustomUpdateBuilder as UpdateBuilder } from "./CustomUpdateBuilder";

/**
 * extend / mixin class
 * 
 * @param aClass 
 * @returns 
 */
function extend<T extends any>(aClass: T) {
  return {
    with(properties: any): T {
      for (const p in properties) {
        Object.defineProperty((aClass as any).prototype, p, { value: properties[p] });
      }
      return aClass;
    }
  };
}

const customBuilder = {
  ReferenceBuilder: extend(ReferenceBuilder).with({
    FunctionBuilder
  }),
  ExpressionBuilder: extend(ExpressionBuilder).with({
    ReferenceBuilder,
    SelectBuilder,
    FunctionBuilder
  }),
  FunctionBuilder: extend(FunctionBuilder).with({
    ExpressionBuilder,
    ReferenceBuilder,
    SelectBuilder
  }),
  SelectBuilder: extend(SelectBuilder).with({
    ExpressionBuilder,
    ReferenceBuilder,
    FunctionBuilder,
    SelectBuilder
  }),
  InsertBuilder: extend(InsertBuilder).with({
    SelectBuilder,
  }),
  UpsertBuilder: extend(InsertBuilder).with({
    SelectBuilder,
  }),
  UpdateBuilder: extend(UpdateBuilder).with({
    ReferenceBuilder,
    ExpressionBuilder,
    FunctionBuilder,
  }),
  DeleteBuilder: extend(DeleteBuilder).with({
    ReferenceBuilder,
    ExpressionBuilder,
    FunctionBuilder,
  })
};

export default customBuilder;