// @ts-nocheck
import { CSN } from "@sap/cds/apis/csn";
import { UpdateBuilder } from "@sap/cds/libx/_runtime/db/sql-builder";
import { PRE_CONVERSION_MAP } from "../conversion-pre";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";

export = class CustomUpdateBuilder extends UpdateBuilder {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    // overwrite quote function
    // @ts-ignore
    this._quoteElement = enhancedQuotingStyles[this._quotingStyle];
  }
  get ReferenceBuilder() {
    const ReferenceBuilder = require("./CustomReferenceBuilder");
    Object.defineProperty(this, "ReferenceBuilder", { value: ReferenceBuilder });
    return ReferenceBuilder;
  }
  get ExpressionBuilder() {
    const ExpressionBuilder = require("./CustomExpressionBuilder");
    Object.defineProperty(this, "ExpressionBuilder", { value: ExpressionBuilder });
    return ExpressionBuilder;
  }

  _data(annotatedColumns) {
    const sql = [];
    const data = this._obj.UPDATE.data || {};
    const withObj = this._obj.UPDATE.with || {};
    const dataObj = Object.assign({}, data, withObj); // with overwrites data, save in new object so CQN still looks the same
    const resMap = this._getFlattenColumnValues(dataObj);
    this._removeAlreadyExistingUpdateAnnotatedColumnsFromMap(annotatedColumns, resMap);

    this._addAnnotatedUpdateColumns(resMap, annotatedColumns);
    const entity = this._csn.definitions[this._obj.UPDATE.entity];

    resMap.forEach((value, key, map) => {
      const columnType = entity.elements?.[key]?.type;
      if (value && value.sql) {
        sql.push(`${this._quoteElement(key)} = ${value.sql}`);
        this._outputObj.values.push(...value.values);
      } else {
        sql.push(`${this._quoteElement(key)} = ?`);
        // convert value for specific type
        if (columnType && PRE_CONVERSION_MAP.has(columnType)) {
          value = PRE_CONVERSION_MAP.get(columnType)(value);
        }
        this._outputObj.values.push(value);
      }
    });

    this._outputObj.sql.push(`SET ${sql.join(", ")}`);
  }
};
