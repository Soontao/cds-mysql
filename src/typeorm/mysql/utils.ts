
/**
 * equal string without case sensitive
 * 
 * @param s1 first string
 * @param s2 second string
 * @returns true if both two string are equal without case sensitive
 */
export function equalWithoutCase(s1: string, s2: string) {
  if (s1 === undefined && s2 === undefined) {
    return true;
  }
  if (s1?.length === 0 && s2?.length === 0) {
    return true;
  }
  if(s1 === s2) {
    return true;
  }
  if (s1?.length === s2?.length && s1?.toLowerCase() === s2?.toLowerCase()) {
    return true;
  }

  return false;
}