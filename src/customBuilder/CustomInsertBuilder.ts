// @ts-nocheck
import { InsertBuilder } from "@sap/cds-runtime/lib/db/sql-builder";

export = class CustomInsertBuilder extends InsertBuilder {

  _createPlaceholderString() {
    // for mysql driver, it will automatically processing single & multiply insert
    return ["VALUES", "?"];
  }

}
