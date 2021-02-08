const ReferenceBuilder = require('../../db/sql-builder').ReferenceBuilder;

class CustomReferenceBuilder extends ReferenceBuilder {
  get FunctionBuilder() {
    const FunctionBuilder = require('./CustomFunctionBuilder');
    Object.defineProperty(this, 'FunctionBuilder', { value: FunctionBuilder });
    return FunctionBuilder;
  }
}

module.exports = CustomReferenceBuilder;
