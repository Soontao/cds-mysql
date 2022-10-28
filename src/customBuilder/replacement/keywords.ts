import Parser from "ts-mysql-parser";

export const MYSQL_KEYWORDS = new Parser().getReservedKeywords();