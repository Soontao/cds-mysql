// pre conversion for INSERT/UPDATE (JSON -> DB)
import { DateTime } from "luxon";
import { MYSQL_DATE_TIME_FORMAT } from "./constants";

/**
 * MySQL required wired formatted date time 'yyyy-MM-dd hh:mm:ss'
 * 
 * @param value 
 */
export function adaptToMySQLDateTime(value: string | Date) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {

    if (DateTime.fromFormat(value, MYSQL_DATE_TIME_FORMAT).isValid) {
      return value;
    }

    const dateTime = DateTime.fromISO(value, { setZone: true });

    if (dateTime.isValid) {
      return dateTime.toFormat(MYSQL_DATE_TIME_FORMAT);
    }

  }

  if (value instanceof Date) {
    return DateTime.fromJSDate(value).toFormat(MYSQL_DATE_TIME_FORMAT);
  }

  return null;

}

export const PRE_CONVERSION_MAP = new Map([
  ["cds.DateTime", adaptToMySQLDateTime],
  ["cds.Timestamp", adaptToMySQLDateTime]
]);