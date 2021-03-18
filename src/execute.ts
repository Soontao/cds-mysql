// @ts-nocheck
import { isEmpty } from "@newdash/newdash";
import { Query } from "@sap/cds-reflect/apis/cqn";
import { getPostProcessMapper, postProcess } from "@sap/cds-runtime/lib/db/data-conversion/post-processing";
import { createJoinCQNFromExpanded, hasExpand, rawToExpanded } from "@sap/cds-runtime/lib/db/expand";
import { Connection } from "mysql2/promise";
import { Readable } from "stream";
import { TYPE_POST_CONVERSION_MAP } from "./conversion";
import CustomBuilder from "./customBuilder";
import { sqlFactory } from "./sqlFactory";

const cds = global.cds || require("@sap/cds/lib");
const LOG = (cds.log || cds.debug)("mysql");

/*
 * helpers
 */
const colored = {
  BEGIN: "\x1b[1m\x1b[33mBEGIN\x1b[0m",
  COMMIT: "\x1b[1m\x1b[32mCOMMIT\x1b[0m",
  ROLLBACK: "\x1b[1m\x1b[91mROLLBACK\x1b[0m"
};

function _executeSimpleSQL(dbc: Connection, sql: string, values: Array<any>) {
  LOG && LOG._debug && LOG.debug(`${colored[sql] || sql} ${values && values.length ? JSON.stringify(values) : ""}`);
  return dbc.query(sql, values);
}

async function executeSelectSQL(dbc: Connection, sql: string, values: Array<any>, isOne: any, postMapper: Function) {
  LOG && LOG._debug && LOG.debug(`${sql} ${JSON.stringify(values)}`);
  const [results] = await dbc.query(sql, values);
  if (isOne && isEmpty(results)) {
    return null;
  }
  return postProcess(Boolean(isOne) ? results[0] : results, postMapper);
}

function _processExpand(model, dbc, cqn, user, locale, txTimestamp) {
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

  return rawToExpanded(expandQueries, queries, cqn.SELECT.one);
}

function executeSelectCQN(model, dbc, query, user, locale, txTimestamp) {
  if (hasExpand(query)) {
    return _processExpand(model, dbc, query, user, locale, txTimestamp);
  }
  const { sql, values = [] } = sqlFactory(
    query,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: txTimestamp || { sql: "now()" }, // '2012-12-03T07:16:23.574Z'
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

function executeDeleteCQN(model, dbc, cqn, user, locale, txTimestamp) {
  const { sql, values = [] } = sqlFactory(
    cqn,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: txTimestamp || { sql: "now()" } // '2012-12-03T07:16:23.574Z'
    },
    model
  );

  return _executeSimpleSQL(dbc, sql, values);
}

function executePlainSQL(dbc: Connection, sql: string, values = [], isOne: any, postMapper: Function) {
  // support named binding parameters
  if (values && typeof values === "object" && !Array.isArray(values)) {
    values = new Proxy(values, {
      getOwnPropertyDescriptor: (o, p) => Object.getOwnPropertyDescriptor(o, p.slice(1)),
      get: (o, p) => o[p.slice(1)],
      ownKeys: o => Reflect.ownKeys(o).map(k => `:${k}`)
    });
  }

  if (/^\s*(select|pragma)/i.test(sql)) {
    return executeSelectSQL(dbc, sql, values, isOne, postMapper);
  }

  if (/^\s*insert/i.test(sql)) {
    return executeInsertSQL(dbc, sql, values);
  }

  return _executeSimpleSQL(dbc, sql, Array.isArray(values[0]) ? values[0] : values);
}

async function executeInsertSQL(dbc: Connection, sql: string, values?: any, query?: Query) {
  LOG && LOG._debug && LOG.debug(`${sql} ${JSON.stringify(values)}`);
  const [{ insertId, affectedRows }] = await dbc.query(sql, [values]);
  return [{ lastID: insertId, affectedRows: affectedRows, values }];
}

function _convertStreamValues(values) {
  let any;
  values.forEach((v, i) => {
    if (v && typeof v.pipe === "function") {
      any = values[i] = new Promise(resolve => {
        const chunks = [];
        v.on("data", chunk => chunks.push(chunk));
        v.on("end", () => resolve(Buffer.concat(chunks)));
        v.on("error", () => {
          v.removeAllListeners("error");
          v.push(null);
        });
      });
    }
  });
  return any ? Promise.all(values) : values;
}

async function executeInsertCQN(model, dbc: Connection, query: Query, user, locale, txTimestamp) {
  const { sql, values = [] } = sqlFactory(
    query,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: txTimestamp || { sql: "now()" } // '2012-12-03T07:16:23.574Z'
    },
    model
  );
  const vals = await _convertStreamValues(values);
  return executeInsertSQL(dbc, sql, vals, query);
}

async function executeUpdateCQN(model, dbc, cqn, user, locale, txTimestamp) {
  const { sql, values = [] } = sqlFactory(
    cqn,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: txTimestamp || { sql: "now()" }
    },
    model
  );
  const vals = await _convertStreamValues(values);
  return executePlainSQL(dbc, sql, vals);
}

// e. g. DROP, CREATE TABLE
function executeGenericCQN(model, dbc, cqn, user, locale, txTimestamp) {
  const { sql, values = [] } = sqlFactory(
    cqn,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: txTimestamp || { sql: "now()" } // '2012-12-03T07:16:23.574Z'
    },
    model
  );

  return executePlainSQL(dbc, sql, values);
}

async function executeSelectStreamCQN(model, dbc, query, user, locale, txTimestamp) {
  const result = await executeSelectCQN(model, dbc, query, user, locale, txTimestamp);

  if (result == null || result.length === 0) {
    return;
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

export default {
  delete: executeDeleteCQN,
  insert: executeInsertCQN,
  update: executeUpdateCQN,
  select: executeSelectCQN,
  stream: executeSelectStreamCQN,
  cqn: executeGenericCQN,
  sql: executePlainSQL
};

