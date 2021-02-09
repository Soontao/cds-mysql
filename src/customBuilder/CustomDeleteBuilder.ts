import { DeleteBuilder } from '@sap/cds-runtime/lib/db/sql-builder';

export = class CustomDeleteBuilder extends DeleteBuilder {
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

