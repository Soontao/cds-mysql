// conversion for OUTPUT (DB -> JSON)
import { DateTime, FixedOffsetZone } from "luxon";
import { MYSQL_DATE_TIME_FORMAT } from "./constants";

const convertToBoolean = boolean => {
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
  if (value === null) {
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
  ["cds.Timestamp", convertToISOTime]
]);

export { TYPE_POST_CONVERSION_MAP };

