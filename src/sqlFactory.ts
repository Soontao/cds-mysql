import { CQN, CSN, cwdRequire } from "cds-internal-tool";

const _getCustomBuilderIfExists = (options, type) => {
  if (options && options.customBuilder) {
    switch (type) {
      case "SELECT": {
        return options.customBuilder.SelectBuilder;
      }
      case "INSERT": {
        return options.customBuilder.InsertBuilder;
      }
      case "UPDATE": {
        return options.customBuilder.UpdateBuilder;
      }
      case "DELETE": {
        return options.customBuilder.DeleteBuilder;
      }
      case "CREATE": {
        return options.customBuilder.CreateBuilder;
      }
      case "DROP": {
        return options.customBuilder.DropBuilder;
      }
    }
  }
};

/**
 * Factory method to build a SQL string from a CQN object.
 * 
 * @param cqn The CQN object used to build the SQL string
 * @param options The configuration object for delimiters and placeholders.
 * @param csn CSN
 * @returns The SQL string
 * @throws Error if no valid CQN object provided
 */
const build = (cqn: CQN, options?: any, csn?: CSN): string => {
  if (!cqn) {
    throw new Error("Cannot build SQL. No CQN object provided.");
  }

  const {
    CreateBuilder,
    DeleteBuilder,
    DropBuilder,
    InsertBuilder,
    SelectBuilder,
    UpdateBuilder
  } = cwdRequire("@sap/cds/libx/_runtime/db/sql-builder");
  const build = (Builder) => {
    return new Builder(cqn, options, csn).build();
  };

  if (options && options.definitions) {
    csn = options;
    options = {};
  }

  if (cqn.SELECT) {
    return build(_getCustomBuilderIfExists(options, "SELECT") ?? SelectBuilder);
  }

  if (cqn.INSERT) {
    return build(_getCustomBuilderIfExists(options, "INSERT") ?? InsertBuilder);
  }

  if (cqn.UPDATE) {
    return build(_getCustomBuilderIfExists(options, "UPDATE") ?? UpdateBuilder);
  }

  if (cqn.DELETE) {
    return build(_getCustomBuilderIfExists(options, "DELETE") ?? DeleteBuilder);
  }

  if (cqn.CREATE) {
    return build(_getCustomBuilderIfExists(options, "CREATE") ?? CreateBuilder);
  }

  if (cqn.DROP) {
    return build(_getCustomBuilderIfExists(options, "DROP") ?? DropBuilder);
  }

  throw new Error(`Cannot build SQL. Invalid CQN object provided: ${JSON.stringify(cqn)}`);
};

export { build as sqlFactory };
