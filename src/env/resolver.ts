import { readFileSync } from "fs";

export function resolveValue(value: string): any {
  if (value.length === 0 || value === undefined)  {
    return value;
  }

  try {
    if (typeof value === "string") {
      // if is path
      if (value.startsWith("./") || value.startsWith("/")) {
        return readFileSync(value, { encoding: "utf-8" });
      } 
      if (value === "true") {
        return true;
      }
      if (value === "false") {
        return false;
      }
      const n = parseFloat(value);
      if (!isNaN(n)) {
        return n;
      }
      return JSON.parse(value);
    }
  } catch (error) {
    // ignore
  }
  return value;
}