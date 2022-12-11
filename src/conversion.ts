// conversion for OUTPUT (DB -> JSON)
import { cwdRequire, cwdRequireCDS } from "cds-internal-tool";
import { DateTime, FixedOffsetZone, ToISOTimeOptions } from "luxon";
import { MYSQL_DATE_TIME_FORMAT, MYSQL_DATE_TIME_FORMAT_WO_FRACTIONS } from "./constants";


/**
 * parse mysql date string
 * 
 * @param value valid mysql date string, with fractions or not
 * 
 * @returns 
 */
export function parseMysqlDate(value: string): DateTime;
export function parseMysqlDate(value: any): null;
export function parseMysqlDate(value: string) {
  if (typeof value !== "string") {
    return null;
  }

  switch (value.length) {
    case MYSQL_DATE_TIME_FORMAT_WO_FRACTIONS.length:
      return DateTime.fromFormat(
        value,
        MYSQL_DATE_TIME_FORMAT_WO_FRACTIONS,
        { zone: FixedOffsetZone.utcInstance }
      );
    default:
      return DateTime.fromFormat(
        value,
        MYSQL_DATE_TIME_FORMAT,
        { zone: FixedOffsetZone.utcInstance }
      );
  }
}


const convertToBoolean = (boolean: any) => {
  if (boolean === null) {
    return null;
  }

  return Boolean(boolean);
};

const convertToDateString = value => {
  if (!value) {
    return null;
  }

  return value;
};

const convertInt64ToString = int64 => {
  if (int64 === null) {
    return null;
  }

  return String(int64);
};

const createConvertToISOTime = (options?: ToISOTimeOptions) => (value: string) => {
  if (value === null || value === undefined) {
    return null;
  }
  const dateTime = parseMysqlDate(value);
  if (dateTime.isValid) {
    return dateTime.toISO(options);
  }
  return null;
};

const convertToISOTime = createConvertToISOTime();

const convertToISONoMilliseconds = createConvertToISOTime({ suppressMilliseconds: true });

const TYPE_POST_CONVERSION_MAP = new Map([
  ["cds.Boolean", convertToBoolean],
  ["cds.Date", convertToDateString],
  ["cds.Integer64", convertInt64ToString],
  ["cds.Int64", convertInt64ToString],
  ["cds.DateTime", convertToISONoMilliseconds],
  ["cds.Timestamp", convertToISOTime],
]);

if (cwdRequireCDS().env.features["bigjs"] === true) {
  const Big = cwdRequire("big.js");
  const convertToBig = (value: any) => new Big(value);

  TYPE_POST_CONVERSION_MAP.set("cds.Integer64", convertToBig);
  TYPE_POST_CONVERSION_MAP.set("cds.Int64", convertToBig);
  TYPE_POST_CONVERSION_MAP.set("cds.Decimal", convertToBig);
}

export { TYPE_POST_CONVERSION_MAP };

