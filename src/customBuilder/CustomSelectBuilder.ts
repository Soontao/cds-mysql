const SelectBuilder = require('@sap/cds-runtime/lib/db/sql-builder').SelectBuilder;

class CustomSelectBuilder extends SelectBuilder {
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
  get FunctionBuilder() {
    const FunctionBuilder = require('./CustomFunctionBuilder');
    Object.defineProperty(this, 'FunctionBuilder', { value: FunctionBuilder });
    return FunctionBuilder;
  }
  get SelectBuilder() {
    const SelectBuilder = require('./CustomSelectBuilder');
    Object.defineProperty(this, 'SelectBuilder', { value: SelectBuilder });
    return SelectBuilder;
  }

  getCollate() {
    return 'COLLATE ' + this.getCollatingSequence();
  }

  getCollatingSequence() {
    return 'NOCASE';
  }

  _forUpdate() { }
}

module.exports = CustomSelectBuilder;
