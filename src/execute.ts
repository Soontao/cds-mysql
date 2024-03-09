// @ts-nocheck
import { filter } from "@newdash/newdash/filter";
import { isEmpty } from "@newdash/newdash/isEmpty";
import { CQN, cwdRequire, cwdRequireCDS, LinkedModel, User } from "cds-internal-tool";
import { QueryObject } from "cds-internal-tool/lib/types/ql";
import { Connection, OkPacket } from "mysql2/promise";
import { Readable } from "stream";
import { TYPE_POST_CONVERSION_MAP } from "./conversion";
import { adaptToMySQLDateTime } from "./conversion-pre";
import CustomBuilder from "./customBuilder";
import { sqlFactory } from "./sqlFactory";
import { getIncrementalKey, mustBeArray } from "./utils";

const cds = cwdRequireCDS();
const LOG = cds.log("db|mysql|sql");
const DEBUG = cds.debug("db|mysql");
const coloredTxCommands = cwdRequire("@sap/cds/libx/_runtime/db/utils/coloredTxCommands");
const { convertStream } = cwdRequire("@sap/cds/libx/_runtime/db/utils/stream");

const { getPostProcessMapper, postProcess } = cwdRequire("@sap/cds/libx/_runtime/db/data-conversion/post-processing");
const {
  createJoinCQNFromExpanded, expandV2,
  hasExpand, rawToExpanded
} = cwdRequire("@sap/cds/libx/_runtime/db/expand");
const SANITIZE_VALUES = process.env.NODE_ENV === "production" && cds.env.log.sanitize_values !== false;

const _captureStack = DEBUG
  ? () => {
    const o = {};
    Error.captureStackTrace(o, _captureStack);
    return o;
  }
  : () => undefined;


const _augmented = (err: Error, sql: string, values: any, o: any) => {
  err.query = sql;
  if (values) err.values = SANITIZE_VALUES ? ["***"] : values;
  err.message += " in: \n" + sql;
  if (o) err.stack = err.message + o.stack.slice(5);
  return err;
};

function _executeSimpleSQL(dbc: Connection, sql: string, values: Array<any>) {
  LOG._debug &&
    LOG.debug(coloredTxCommands[sql] || sql, Array.isArray(values) ? (SANITIZE_VALUES ? ["***"] : values) : "");
  const o = _captureStack();
  try {
    return dbc.query(sql, values);
  } catch (err) {
    throw _augmented(err, sql, values, o);
  }
}

async function executeSelectSQL(dbc: Connection, sql: string, values: Array<any>, isOne: any, postMapper: Function) {
  LOG._debug && LOG.debug(sql, SANITIZE_VALUES ? ["***"] : values);
  const o = _captureStack();
  try {
    const [results] = await dbc.query(sql, values);
    if (isOne && isEmpty(results)) {
      return null;
    }
    return postProcess(Boolean(isOne) ? results[0] : results, postMapper);
  } catch (err) {
    throw _augmented(err, sql, values, o);
  }
}

function _processExpand(
  model: LinkedModel,
  dbc: Connection,
  cqn: CQN,
  user: User,
  locale: string,
  txTimestamp: any
) {
  const queries = [];
  const expandQueries = createJoinCQNFromExpanded(cqn, model, false, locale);

  for (const cqn of expandQueries.queries) {
    cqn._conversionMapper = getPostProcessMapper(TYPE_POST_CONVERSION_MAP, model, cqn);

    // REVISIT
    // Why is the post processing in expand different?
    const { sql, values } = sqlFactory(cqn, {
      user,
      now: txTimestamp,
      customBuilder: CustomBuilder
    });
    queries.push(executeSelectSQL(dbc, sql, values, false));
  }

  return rawToExpanded(expandQueries, queries, cqn.SELECT.one, cqn._target);
}

function executeSelectCQN(
  model: LinkedModel,
  dbc: Connection,
  query: QueryObject,
  user: User,
  locale: string,
  txTimestamp: any
) {
  if (hasExpand(query)) {
    // expand: '**' or '*3' is handled by new impl
    if (query.SELECT.columns.some(c => c.expand && typeof c.expand[0] === "string" && /^\*{1}[\d|*]+/.test(c.expand[0]))) {
      return expandV2(model, dbc, query, user, locale, txTimestamp, executeSelectCQN);
    }
    return _processExpand(model, dbc, query, user, locale, txTimestamp);
  }
  const { sql, values = [] } = sqlFactory(
    query,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: getNow(txTimestamp),
      locale
    },
    model
  );

  return executeSelectSQL(
    dbc,
    sql,
    values,
    query.SELECT.one,
    getPostProcessMapper(TYPE_POST_CONVERSION_MAP, model, query)
  );
}

function executeDeleteCQN(
  model: LinkedModel,
  dbc: Connection,
  cqn: CQN,
  user: User,
  locale: string,
  txTimestamp: any
) {
  const { sql, values = [] } = sqlFactory(
    cqn,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: getNow(txTimestamp), // '2012-12-03T07:16:23.574Z'
    },
    model
  );

  return _executeSimpleSQL(dbc, sql, values);
}

function executePlainSQL(
  dbc: Connection,
  sql: string,
  values: Array<any> = [],
  isOne: any,
  postMapper: Function
) {
  // support named binding parameters
  if (values && typeof values === "object" && !Array.isArray(values)) {
    values = new Proxy(values, {
      getOwnPropertyDescriptor: (o, p) => Object.getOwnPropertyDescriptor(o, p.slice(1)),
      get: (o, p) => o[p.slice(1)],
      ownKeys: (o) => Reflect.ownKeys(o).map((k) => `:${k}`)
    });
  }

  if (/^\s*(select|pragma)/i.test(sql)) {
    return executeSelectSQL(dbc, sql, values, isOne, postMapper);
  }

  if (/^\s*insert/i.test(sql) || /^\s*upsert/i.test(sql)) {
    return executeInsertSQL(dbc, sql, values);
  }

  return _executeSimpleSQL(dbc, sql, Array.isArray(values[0]) ? values[0] : values);
}

async function executeInsertSQL(
  dbc: Connection,
  sql: string,
  values?: any,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  query?: QueryObject
) {
  LOG._debug && LOG.debug(sql, SANITIZE_VALUES ? ["***"] : values);

  const o = _captureStack();

  try {
    const results: Array<OkPacket> = await dbc.query(sql, [values]);
    return filter(results, (value?: OkPacket) => value !== undefined)
      .map(({ insertId, affectedRows }) => ({
        lastID: insertId,
        affectedRows: affectedRows,
        values
      }));
  } catch (error) {
    throw _augmented(error, sql, values, o);
  }
}

async function _convertStreamValues(values: Array<any>) {
  let any;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v instanceof Readable) {
      any = values[i] = new Promise(resolve => {
        const chunks = [];
        v.on("data", chunk => chunks.push(chunk));
        v.on("end", () => resolve(Buffer.concat(chunks)));
        v.on("error", () => {
          v.removeAllListeners("error");
          v.push(null);
        });
      });
    } else if (Array.isArray(v)) {
      values[i] = await _convertStreamValues(v);
    }
  }
  return any ? Promise.all(values) : values;
}

async function executeInsertCQN(
  model: LinkedModel,
  dbc: Connection,
  query: QueryObject,
  user: User,
  locale: string,
  txTimestamp: any
) {
  const { sql, values = [] } = sqlFactory(
    query,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: getNow(txTimestamp), // '2012-12-03T07:16:23.574Z'
    },
    model
  );
  const vals = await _convertStreamValues(values);
  const mappedResults = await executeInsertSQL(dbc, sql, vals, query);
  // write back the insert id to response body
  if (
    cds.context?.target?.kind === "entity" &&
    cds.context?.data !== undefined
  ) {
    const key = getIncrementalKey(cds.context.target);
    if (key !== undefined) {
      for (const row of mustBeArray(cds.context.data)) {
        row[key.name] = mappedResults[0].lastID;
      }
    }
  }
  return mappedResults;
}

async function executeUpdateCQN(
  model: LinkedModel,
  dbc: Connection,
  cqn: CQN,
  user: User,
  locale: string,
  txTimestamp: any
) {
  const { sql, values = [] } = sqlFactory(
    cqn,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: getNow(txTimestamp),
    },
    model
  );
  const vals = await _convertStreamValues(values);
  return executePlainSQL(dbc, sql, vals);
}

// e. g. DROP, CREATE TABLE
function executeGenericCQN(
  model: LinkedModel,
  dbc: Connection,
  cqn: CQN,
  user: User,
  locale: string,
  txTimestamp: any,
) {
  const { sql, values = [] } = sqlFactory(
    cqn,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: getNow(txTimestamp),
    },
    model
  );

  return executePlainSQL(dbc, sql, values);
}

async function executeSelectStreamCQN({ model, dbc, query, user, locale, txTimestamp }) {
  const result = await executeSelectCQN(model, dbc, query, user, locale, txTimestamp);

  if (result == null || result.length === 0) {
    return;
  }

  if (!cds.env.features.stream_compat) {
    convertStream(query.SELECT.columns, query.target, result, query.SELECT.one);
    return result;
  }

  let val = Array.isArray(result) ? Object.values(result[0])[0] : Object.values(result)[0];
  if (val === null) {
    return null;
  }
  if (typeof val === "number") {
    val = val.toString();
  }

  const stream_ = new Readable();
  stream_.push(val);
  stream_.push(null);

  return { value: stream_ };
}

function getNow(txTimestamp: string) {
  return txTimestamp === undefined ? { sql: "now()" } : adaptToMySQLDateTime(txTimestamp);
}

export default {
  delete: executeDeleteCQN,
  insert: executeInsertCQN,
  update: executeUpdateCQN,
  select: executeSelectCQN,
  stream: executeSelectStreamCQN,
  convert: convertStream,
  cqn: executeGenericCQN,
  sql: executePlainSQL
};
