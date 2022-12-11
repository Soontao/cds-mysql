// pre conversion for INSERT/UPDATE (JSON -> DB)
import { DateTime } from "luxon";
import { MYSQL_DATE_TIME_FORMAT } from "./constants";
import { parseMysqlDate } from "./conversion";

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

    // if is ISO datetime format
    if (value[10] === "T") {
      const datetime = DateTime.fromISO(value, { setZone: true });
      if (datetime.isValid) {
        return datetime.toUTC().toFormat(MYSQL_DATE_TIME_FORMAT);
      }
    }

    // if is valid mysql datetime value
    const datetime = parseMysqlDate(value);
    if (datetime.isValid) {
      return datetime.toFormat(MYSQL_DATE_TIME_FORMAT);
    }

  }

  // if is date object
  if (value instanceof Date) {
    return DateTime.fromJSDate(value).toFormat(MYSQL_DATE_TIME_FORMAT);
  }

  return null;

}

export const PRE_CONVERSION_MAP = new Map([
  ["cds.DateTime", adaptToMySQLDateTime],
  ["cds.Timestamp", adaptToMySQLDateTime]
]);