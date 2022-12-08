import { capitalize } from "@newdash/newdash/capitalize";
import { CQN, CSN, cwdRequire, cwdRequireCDS } from "cds-internal-tool";
import { CQNKind } from "./types";


/**
 * Factory method to build a SQL string from a CQN object.
 * 
 * @param cqn The CQN object used to build the SQL string
 * @param options The configuration object for delimiters and placeholders.
 * @param csn CSN
 * @returns 
 * @throws Error if no valid CQN object provided
 */
const build = (cqn: CQN, options?: any, csn?: CSN): { sql: string, values: Array<any> } => {
  if (!cqn) {
    throw new Error("Cannot build SQL. No CQN object provided.");
  }

  const defaultBuilders = cwdRequire("@sap/cds/libx/_runtime/db/sql-builder");

  if (options && options.definitions) {
    csn = options;
    options = {};
  }

  const kind: CQNKind = Object.keys(cqn)[0] as any;

  if (kind !== undefined) {

    if (kind === "CREATE" || kind === "DROP") {
      throw cwdRequireCDS().error(`ERROR_NOT_SUPPORT_CQN_${kind}`);
    }

    const builderName = `${capitalize(kind)}Builder`;

    const Builder = options.customBuilder?.[builderName] ?? defaultBuilders?.[builderName];

    if (Builder !== undefined) {
      return new Builder(cqn, options, csn).build();
    }

  }

  throw new Error(`Cannot build SQL. Invalid CQN object provided: ${JSON.stringify(cqn)}`);
};

export { build as sqlFactory };
