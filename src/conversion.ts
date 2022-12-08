// conversion for OUTPUT (DB -> JSON)
import { cwdRequire, cwdRequireCDS } from "cds-internal-tool";
import { DateTime, FixedOffsetZone } from "luxon";
import { MYSQL_DATE_TIME_FORMAT } from "./constants";

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

const convertToISOTime = (value: string) => {
  if (value === null || value === undefined) {
    return value;
  }
  const dateTime = DateTime.fromFormat(value, MYSQL_DATE_TIME_FORMAT, {
    zone: FixedOffsetZone.instance(0)
  });
  return dateTime.toISO();
};

const convertToISONoMilliseconds = (element: string) => {
  if (element) {
    const dateTime = DateTime.fromFormat(element, MYSQL_DATE_TIME_FORMAT, {
      zone: FixedOffsetZone.instance(0)
    });
    return dateTime.toISO({ suppressMilliseconds: true });
  }
  return null;
};

const TYPE_POST_CONVERSION_MAP = new Map([
  ["cds.Boolean", convertToBoolean],
  ["cds.Date", convertToDateString],
  ["cds.Integer64", convertInt64ToString],
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

