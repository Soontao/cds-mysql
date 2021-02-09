// @ts-nocheck
import { InsertBuilder } from "@sap/cds-runtime/lib/db/sql-builder";
import { PRE_CONVERSION_MAP } from "../conversion-pre";

export = class CustomInsertBuilder extends InsertBuilder {

  _createPlaceholderString() {
    // for mysql driver, it will automatically processing single & multiply insert
    return ["VALUES", "?"];
  }

  _addEntries(valuesArray, { columns, flattenColumnMap, purelyManagedColumnValues, insertAnnotatedColumns }) {
    const checkerForInconsistentColumns = this._checkerForInconsistentColumns(insertAnnotatedColumns);
    const entity = this._csn.definitions[this._obj.INSERT.into];
    for (const entry of this._obj.INSERT.entries) {
      const values = [];

      const flattenEntryColumns = this._getFlattenEntryColumns(entry);
      checkerForInconsistentColumns(flattenEntryColumns);

      for (const column of columns) {
        const flattenColumn = flattenColumnMap.get(column);
        const columnType = entity?.elements?.[column]?.type;
        const val = this._getValue(column, { entry, flattenColumn, insertAnnotatedColumns, columnType });
        values.push(val);
      }

      // insert values for insert annotated columns
      values.push(...purelyManagedColumnValues.values);

      valuesArray.push(values);
    }
  }

  _getValue(column, { entry, flattenColumn, insertAnnotatedColumns, columnType }) {
    let val = entry;
    if (!flattenColumn && this.uuidKeys.includes(column)) {
      val = cds.utils.uuid();
    } else {
      for (const key of flattenColumn) {
        val = this._traverseValue(key, val);
      }
    }
    // convert value for specific type
    if (columnType && PRE_CONVERSION_MAP.has(columnType)) {
      val = PRE_CONVERSION_MAP.get(columnType)(val);
    }
    return val === undefined ? this._getSubstituteForUndefined(column, insertAnnotatedColumns) : val;
  }


}
