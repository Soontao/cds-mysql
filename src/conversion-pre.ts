// pre conversion for INSERT/UPDATE
import { DateTime } from "luxon";

/**
 * MySQL required wired formatted date time 'yyyy-MM-dd hh:mm:ss'
 * 
 * @param value 
 */
function adaptToMySQLDateTime(value: string) {
  if (value === null || value === undefined) {
    return null;
  }
  const dateTime = DateTime.fromISO(value, { setZone: true });
  if (dateTime.isValid) {
    return dateTime.toFormat("yyyy-MM-dd hh:mm:ss");
  } else {
    return null;
  }
}

export const PRE_CONVERSION_MAP = new Map([
  ["cds.DateTime", adaptToMySQLDateTime],
  ["cds.Timestamp", adaptToMySQLDateTime]
]);