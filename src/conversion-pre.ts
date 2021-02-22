// pre conversion for INSERT/UPDATE (JSON -> DB)
import { DateTime } from "luxon";
import { MYSQL_DATE_TIME_FORMAT } from "./constants";

/**
 * MySQL required wired formatted date time 'yyyy-MM-dd hh:mm:ss'
 * 
 * @param value 
 */
function adaptToMySQLDateTime(value: string) {
  if (value === null) {
    return null;
  }
  const dateTime = DateTime.fromISO(value, { setZone: true });
  if (dateTime.isValid) {
    return dateTime.toFormat(MYSQL_DATE_TIME_FORMAT);
  } else {
    return null;
  }
}

export const PRE_CONVERSION_MAP = new Map([
  ["cds.DateTime", adaptToMySQLDateTime],
  ["cds.Timestamp", adaptToMySQLDateTime]
]);