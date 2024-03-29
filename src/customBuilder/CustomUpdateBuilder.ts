import { CSN, cwdRequire, LinkedEntityDefinition } from "cds-internal-tool";
import { PRE_CONVERSION_MAP } from "../conversion-pre";
import { enhancedQuotingStyles } from "./replacement/quotingStyles";
import { AnnotatedColumns } from "./types";

const { UpdateBuilder } = cwdRequire("@sap/cds/libx/_runtime/db/sql-builder");


export class CustomUpdateBuilder extends UpdateBuilder {
  constructor(obj: any, options: any, csn: CSN) {
    super(obj, options, csn);
    // overwrite quote function
    this._quoteElement = enhancedQuotingStyles.plain;
  }

  /**
   * @mysql
   * 
   * @param annotatedColumns 
   * @param entity 
   */
  _data(annotatedColumns: AnnotatedColumns, entity: LinkedEntityDefinition) {
    const sql = [];
    const data = this._obj.UPDATE.data || {};
    const withObj = this._obj.UPDATE.with || {};
    const dataObj = Object.assign({}, data, withObj); // with overwrites data, save in new object so CQN still looks the same
    const resMap = this._getFlattenColumnValues(dataObj);
    this._removeAlreadyExistingUpdateAnnotatedColumnsFromMap(annotatedColumns, resMap);

    this._addAnnotatedUpdateColumns(resMap, annotatedColumns);

    if (entity && entity.keys) {
      resMap.forEach((value, key, map) => {
        if (key in entity.keys) map.delete(key);
      });
    }

    resMap.forEach((value, key) => {
      if (value && value.sql) {
        sql.push(`${this._quoteElement(key)} = ${value.sql}`);
        this._outputObj.values.push(...value.values);
      } else {
        sql.push(`${this._quoteElement(key)} = ?`);
        const columnType = entity?.elements?.[key]?.type;
        // convert value for specific type
        if (columnType !== undefined && PRE_CONVERSION_MAP.has(columnType)) {
          value = PRE_CONVERSION_MAP.get(columnType)(value);
        }
        this._outputObj.values.push(value);
      }
    });

    this._outputObj.sql.push(`SET ${sql.join(", ")}`);
  }
};
