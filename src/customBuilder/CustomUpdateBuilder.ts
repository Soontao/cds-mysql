const UpdateBuilder = require('../../db/sql-builder').UpdateBuilder;

class CustomUpdateBuilder extends UpdateBuilder {
  get ReferenceBuilder() {
    const ReferenceBuilder = require('./CustomReferenceBuilder');
    Object.defineProperty(this, 'ReferenceBuilder', { value: ReferenceBuilder });
    return ReferenceBuilder;
  }
  get ExpressionBuilder() {
    const ExpressionBuilder = require('./CustomExpressionBuilder');
    Object.defineProperty(this, 'ExpressionBuilder', { value: ExpressionBuilder });
    return ExpressionBuilder;
  }
}

module.exports = CustomUpdateBuilder;
