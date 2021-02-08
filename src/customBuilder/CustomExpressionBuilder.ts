const ExpressionBuilder = require('../../db/sql-builder').ExpressionBuilder;

class CustomExpressionBuilder extends ExpressionBuilder {
  get ReferenceBuilder() {
    const ReferenceBuilder = require('./CustomReferenceBuilder');
    Object.defineProperty(this, 'ReferenceBuilder', { value: ReferenceBuilder });
    return ReferenceBuilder;
  }

  get SelectBuilder() {
    const SelectBuilder = require('./CustomSelectBuilder');
    Object.defineProperty(this, 'SelectBuilder', { value: SelectBuilder });
    return SelectBuilder;
  }

  get FunctionBuilder() {
    const FunctionBuilder = require('./CustomFunctionBuilder');
    Object.defineProperty(this, 'FunctionBuilder', { value: FunctionBuilder });
    return FunctionBuilder;
  }
}

module.exports = CustomExpressionBuilder;
