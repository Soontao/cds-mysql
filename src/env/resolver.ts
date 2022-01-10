import { readFileSync } from "fs";

export function resolveValue(value: string): any {
  try {
    // if is path
    if (value.startsWith("./") || value.startsWith("/")) {
      return readFileSync(value, { encoding: "utf-8" });
    } 
    return JSON.parse(value);
  } catch (error) {
    // ignore
  }
  return value;
}