import { smartId } from "@sap/cds-compiler/lib/sql-identifier";
import * as quotingStyles from "@sap/cds/libx/_runtime/common/utils/quotingStyles";
import { MYSQL_KEYWORDS } from "./keywords";


const _dialect = {
  regularRegex: /^[A-Za-z_][A-Za-z_$0-9]*$/,
  reservedWords: MYSQL_KEYWORDS,
  effectiveName: (name: string) => name,
  asDelimitedId: (name: string) => `"${name.replace(/"/g, '""')}"`,
};

const _isQuoted = (s: string) => s.match(/^".*"$/);
const _slugify = (s: string) => s.replace(/\./g, "_");
const _smartId = (s: string) => smartId(_slugify(s), _dialect);

export const enhancedQuotingStyles = {
  ...quotingStyles,
  plain: (s: string) => {
    // * or already quoted?
    if (s === "*" || _isQuoted(s)) return s;
    if (typeof s !== 'string') throw new Error(`string expected but ${typeof s} received`)
    return _smartId(s);
  },
};
