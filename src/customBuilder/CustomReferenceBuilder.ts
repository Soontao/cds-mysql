import { ReferenceBuilder } from '@sap/cds-runtime/lib/db/sql-builder';

export = class CustomReferenceBuilder extends ReferenceBuilder {
  get FunctionBuilder() {
    const FunctionBuilder = require('./CustomFunctionBuilder');
    Object.defineProperty(this, 'FunctionBuilder', { value: FunctionBuilder });
    return FunctionBuilder;
  }
}
