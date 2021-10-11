import cds from "@sap/cds";
import keywords from "@sap/cds-compiler/lib/base/keywords";
import { smartId } from "@sap/cds-compiler/lib/sql-identifier";
import * as quotingStyles from "@sap/cds/libx/_runtime/common/utils/quotingStyles";

const _dialect = {
  regularRegex: /^[A-Za-z_][A-Za-z_$0-9]*$/,
  reservedWords: keywords.sqlite,
  effectiveName: (name: string) => name,
  asDelimitedId: (name: string) => `"${name.replace(/"/g, '""')}"`,
};

const _reserved = new Set(["WHERE", "GROUP", "ORDER", "BY", "AT", "NO", "LIMIT"]);

const _isTruthy = (s: string) => s;
const _isQuoted = (s: string) => s.match(/^".*"$/);

const _slugify = (s: string) => s.replace(/\./g, "_");
const _smartId = (s: string) => smartId(_slugify(s), _dialect);
const _smartElement = (s: string) => {
  if (s === "*" || _isQuoted(s)) return s;
  const upper = s.toUpperCase();
  if (_reserved.has(upper)) return upper;
  return _smartId(s);
};

export const enhancedQuotingStyles = {
  ...quotingStyles,
  plain: (s: string) => {

    // * or already quoted?
    if (s === "*" || _isQuoted(s)) return s;

    // expr or space in name?
    // REVISIT: default behavior in cds^6?
    // @ts-ignore
    if (s.match(/\s/) && !cds.env.sql?.spaced_columns) {
      return s.split(" ").filter(_isTruthy).map(_smartElement).join(" ");
    }

    return _smartId(s);
  },

};
