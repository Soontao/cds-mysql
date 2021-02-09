// pre conversion for INSERT/UPDATE
import { DateTime } from "luxon";

function adaptToMySQLDateTime(value: string) {
  if (value === null || value === undefined) {
    return null;
  }
  const dateTime = DateTime.fromISO(value);
  return dateTime.toFormat("YYYY-MM-DD hh:mm:ss");
}

export const PRE_CONVERSION_MAP = new Map([
  ["cds.DateTime", adaptToMySQLDateTime],
  ["cds.TimeStamp", adaptToMySQLDateTime]
]);