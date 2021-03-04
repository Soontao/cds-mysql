// @ts-nocheck
import { InsertBuilder } from "@sap/cds-runtime/lib/db/sql-builder";
import getAnnotatedColumns from "@sap/cds-runtime/lib/db/sql-builder/annotations";
import * as dollar from "@sap/cds-runtime/lib/db/sql-builder/dollar";
import { PRE_CONVERSION_MAP } from "../conversion-pre";

export = class CustomInsertBuilder extends InsertBuilder {

  /**
  * Builds an Object based on the properties of the CQN object.
  * @example <caption>Example output</caption>
  * {
  *    sql: 'INSERT INTO "T" ("a", "b", "c") VALUES (?, ?, ?)',
  *    values: [1, 2, '\'asd\'']
  * }
  *
  * @returns {{sql: string, values: Array}} Object with two properties.
  * 
  * SQL string for prepared statement and array of values to replace the placeholders.
  * Property values can be an Array of Arrays for Batch insert of multiple rows.
  */
  build() {
    this._outputObj = {
      sql: ["INSERT", "INTO"],
      values: [],
      columns: []
    };

    // replace $ values
    // REVISIT: better
    if (this._obj.INSERT.entries) {
      dollar.entries(this._obj.INSERT.entries, this._options.user, this._options.now);
    } else if (this._obj.INSERT.values) {
      dollar.values(this._obj.INSERT.values, this._options.user, this._options.now);
    } else if (this._obj.INSERT.rows) {
      dollar.rows(this._obj.INSERT.rows, this._options.user, this._options.now);
    }

    const entityName = this._into();

    // side effect: sets this.uuidKeys if found any
    this._findUuidKeys(entityName);

    this._columnIndexesToDelete = [];
    const annotatedColumns = getAnnotatedColumns(entityName, this._csn);

    if (this._obj.INSERT.columns) {
      this._removeAlreadyExistingInsertAnnotatedColumnsFromMap(annotatedColumns);
      this._columns(annotatedColumns);
    }

    if (this._obj.INSERT.values || this._obj.INSERT.rows) {
      if (annotatedColumns && !this._obj.INSERT.columns) {
        // if columns not provided get indexes from csn
        this._getAnnotatedColumnIndexes(annotatedColumns);
      }

      this._values(annotatedColumns);
    } else if (this._obj.INSERT.entries && this._obj.INSERT.entries.length !== 0) {
      this._entries(annotatedColumns);
    }

    if (this._obj.INSERT.as) {
      this._as(this._obj.INSERT.as);
    }

    this._outputObj.sql = this._outputObj.sql.join(" ");

    const entity = this._csn.definitions[entityName];

    this._outputObj.columns.forEach((column: string, colIndex: number) => {
      const columnType = entity?.elements?.[column]?.type;
      this._outputObj.values.forEach(row => {
        const value = row[colIndex];
        if (columnType && PRE_CONVERSION_MAP.has(columnType)) {
          const val = PRE_CONVERSION_MAP.get(columnType)(value);
          row[colIndex] = val;
        }
      });
    });

    return this._outputObj;
  }

  _entriesSqlString(columns, placeholderNum, valuesAndSQLs) {
    this._outputObj.columns.push(...columns);
    return super._entriesSqlString(columns, placeholderNum, valuesAndSQLs);
  }

  _columns(annotatedColumns) {
    this._outputObj.sql.push("(");

    const insertColumns = [...this._obj.INSERT.columns.map(col => this._quoteElement(col))];

    if (this.uuidKeys) {
      for (const key of this.uuidKeys) {
        if (!this._obj.INSERT.columns.includes(key)) {
          insertColumns.unshift(this._quoteElement(key));
        }
      }
    }

    this._outputObj.columns.push(...insertColumns);
    this._outputObj.sql.push(insertColumns.join(", "));

    if (annotatedColumns) {
      // add insert annotated columns
      this._columnAnnotatedAdded(annotatedColumns);
    }

    this._outputObj.sql.push(")");
  }


  _columnAnnotatedAdded(annotatedColumns) {
    const annotatedInsertColumnNames = this._getAnnotatedInsertColumnNames(annotatedColumns);

    if (annotatedInsertColumnNames && annotatedInsertColumnNames.length !== 0) {
      this._outputObj.columns.push(...annotatedInsertColumnNames);
      this._outputObj.sql.push(",", annotatedInsertColumnNames.map(col => this._quoteElement(col)).join(", "));
    }
  }

  _createPlaceholderString() {
    // for mysql driver, it will automatically processing single & multiply insert
    return ["VALUES", "?"];
  }


}
