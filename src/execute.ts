// @ts-nocheck
const { TYPE_CONVERSION_MAP } = require('./conversion');
const CustomBuilder = require('./customBuilder');
const { sqlFactory } = require('@sap/cds-runtime/lib/db/sql-builder/');
const { getPostProcessMapper, postProcess } = require('@sap/cds-runtime/lib/db/data-conversion/post-processing');
const { createJoinCQNFromExpanded, hasExpand, rawToExpanded } = require('@sap/cds-runtime/lib/db/expand');
const { Readable } = require('stream');

const cds = global.cds || require('@sap/cds/lib');
const LOG = (cds.log || cds.debug)('mysql');

/*
 * helpers
 */
const colored = {
  BEGIN: '\x1b[1m\x1b[33mBEGIN\x1b[0m',
  COMMIT: '\x1b[1m\x1b[32mCOMMIT\x1b[0m',
  ROLLBACK: '\x1b[1m\x1b[91mROLLBACK\x1b[0m'
};

function _executeSimpleSQL(dbc, sql, values) {
  LOG && LOG._debug && LOG.debug(`${colored[sql] || sql} ${values && values.length ? JSON.stringify(values) : ''}`);
  return new Promise((resolve, reject) => {
    dbc.run(sql, values, function (err) {
      if (err) {
        err.query = sql;
        return reject(err);
      }
      resolve(this.changes);
    });
  });
}

function executeSelectSQL(dbc, sql, values, isOne, postMapper) {
  LOG && LOG._debug && LOG.debug(`${sql} ${JSON.stringify(values)}`);
  return new Promise((resolve, reject) => {
    dbc[isOne ? 'get' : 'all'](sql, values, (err, result) => {
      if (err) {
        err.query = sql;
        return reject(err);
      }

      // REVISIT
      // .get returns undefined if nothing in db
      // our coding expects the result to be null if isOne does not return anything
      // REVISIT: -> we should definitely fix that coding which expects null
      if (isOne && result === undefined) {
        result = null;
      }

      resolve(postProcess(result, postMapper));
    });
  });
}

function _processExpand(model, dbc, cqn, user, locale, txTimestamp) {
  const queries = [];
  const expandQueries = createJoinCQNFromExpanded(cqn, model, false, locale);

  for (const cqn of expandQueries.queries) {
    cqn._conversionMapper = getPostProcessMapper(TYPE_CONVERSION_MAP, model, cqn);

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
      now: txTimestamp || { sql: "strftime('%Y-%m-%dT%H:%M:%fZ','now')" }, // '2012-12-03T07:16:23.574Z'
      locale
    },
    model
  );

  return executeSelectSQL(
    dbc,
    sql,
    values,
    query.SELECT.one,
    getPostProcessMapper(TYPE_CONVERSION_MAP, model, query)
  );
}

function executeDeleteCQN(model, dbc, cqn, user, locale, txTimestamp) {
  const { sql, values = [] } = sqlFactory(
    cqn,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: txTimestamp || { sql: "strftime('%Y-%m-%dT%H:%M:%fZ','now')" } // '2012-12-03T07:16:23.574Z'
    },
    model
  );

  return _executeSimpleSQL(dbc, sql, values);
}

const _executeBulkInsertSQL = (dbc, sql, values) =>
  new Promise((resolve, reject) => {
    if (!Array.isArray(values)) {
      return reject(new Error(`Cannot execute SQL statement. Invalid values provided: ${JSON.stringify(values)}`));
    }

    LOG && LOG._debug && LOG.debug(`${sql} ${JSON.stringify(values)}`);
    const stmt = dbc.prepare(sql, err => {
      if (err) {
        err.query = sql;
        return reject(err);
      }

      if (!Array.isArray(values[0])) values = [values];

      // guarantee order through counters in closure
      let i = 0;
      let n = values.length;
      const results = Array(n);
      values.forEach(each => {
        const k = i;
        i++;
        stmt.run(each, function (err) {
          if (err) {
            err.values = each;
            stmt.finalize();
            return reject(err);
          }
          // InsertResult needs an object per row with its values
          results[k] = { lastID: this.lastID, affectedRows: 1, values: each };
          n--;
          if (n === 0) {
            stmt.finalize();
            resolve(results);
          }
        });
      });
    });
  });

function executePlainSQL(dbc, sql, values, isOne, postMapper) {
  // support named binding parameters
  if (values && typeof values === 'object' && !Array.isArray(values)) {
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

function executeInsertSQL(dbc, sql, values?, query?) {
  // Only bulk inserts will have arrays in arrays
  if (Array.isArray(values[0])) {
    if (values.length > 1) {
      return _executeBulkInsertSQL(dbc, sql, values);
    } else {
      values = values[0];
    }
  }

  LOG && LOG._debug && LOG.debug(`${sql} ${JSON.stringify(values)}`);

  return new Promise((resolve, reject) =>
    dbc.run(sql, values, function (err) {
      if (err) return reject(Object.assign(err, { query: sql }));
      // InsertResult needs an object per row with its values
      if (query && values.length > 0) {
        // > single row via cqn
        resolve([{ lastID: this.lastID, affectedRows: 1, values }]);
      } else {
        // > plain sql or INSERT into SELECT
        resolve([{ lastID: this.lastID, affectedRows: this.changes }]);
      }
    })
  );
}

function _convertStreamValues(values) {
  let any;
  values.forEach((v, i) => {
    if (v && typeof v.pipe === 'function') {
      any = values[i] = new Promise(resolve => {
        const chunks = [];
        v.on('data', chunk => chunks.push(chunk));
        v.on('end', () => resolve(Buffer.concat(chunks)));
        v.on('error', () => {
          v.removeAllListeners('error');
          v.push(null);
        });
      });
    }
  });
  return any ? Promise.all(values) : values;
}

async function executeInsertCQN(model, dbc, query, user, locale, txTimestamp) {
  const { sql, values = [] } = sqlFactory(
    query,
    {
      user: user,
      customBuilder: CustomBuilder,
      now: txTimestamp || { sql: "strftime('%Y-%m-%dT%H:%M:%fZ','now')" } // '2012-12-03T07:16:23.574Z'
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
      now: txTimestamp || { sql: "strftime('%Y-%m-%dT%H:%M:%fZ','now')" } // '2012-12-03T07:16:23.574Z'
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
      now: txTimestamp || { sql: "strftime('%Y-%m-%dT%H:%M:%fZ','now')" } // '2012-12-03T07:16:23.574Z'
    },
    model
  );

  return executePlainSQL(dbc, sql, values);
}

async function executeSelectStreamCQN(model, dbc, query, user, locale, txTimestamp) {
  const result = await executeSelectCQN(model, dbc, query, user, locale, txTimestamp);

  if (result.length === 0) {
    return;
  }

  let val = Object.values(result[0])[0];
  if (val === null) {
    return null;
  }
  if (typeof val === 'number') {
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

