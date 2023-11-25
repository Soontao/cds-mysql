import { lazy } from "./utils";
import { Readable } from "stream";
import convStrm from "stream/consumers";
import { getMySQLCredential } from "./admin-tool";
import { DEFAULT_POOL_OPTIONS, MYSQL_COLLATE } from "./constants";
import { createConnection } from "mysql2/promise";
import { MYSQL_KEYWORDS } from "./customBuilder/replacement/keywords";

export default class MYSQLService extends lazy.SQLService {
  get factory() {
    return {
      options: {
        ...DEFAULT_POOL_OPTIONS,
        ...lazy.db_options.pool
      },
      create: tenant => {
        const credential = {
          ...getMySQLCredential(tenant),
          dateStrings: true,
          charset: MYSQL_COLLATE
        };
        return createConnection(credential);
      },
      validate: (conn) => conn
        .query("SELECT 1")
        .then(() => true)
        .catch((err) => {
          lazy.logger.error("validate connection failed:", err);
          return false;
        }),
      destroy: async (conn) => {
        await conn.end();
      }
    };
  }


  set(variables: Record<string, string>) {
    // TODO: set session_variables table

  }

  release() {
    // TODO: clean session_variables table
    return super.release();
  }

  prepare(sql) {
    try {
      const stmt = this.dbc.prepare(sql);
      return {
        run: (..._) => this._run(stmt, ..._),
        get: (..._) => stmt.get(..._),
        all: (..._) => stmt.all(..._),
        stream: (..._) => this._stream(stmt, ..._),
      };
    } catch (e) {
      e.message += " in:\n" + (e.sql = sql);
      throw e;
    }
  }

  async _run(stmt, binding_params) {
    for (let i = 0; i < binding_params.length; i++) {
      const val = binding_params[i];
      if (Buffer.isBuffer(val)) {
        binding_params[i] = Buffer.from(val.base64Slice());
      } else if (typeof val === "object" && val && val.pipe) {
        // REVISIT: stream.setEncoding('base64') sometimes misses the last bytes
        // if (val.type === 'binary') val.setEncoding('base64')
        binding_params[i] = await convStrm.buffer(val);
        if (val.type === "binary") binding_params[i] = Buffer.from(binding_params[i].toString("base64"));
      }
    }
    return stmt.run(binding_params);
  }

  async *_iterator(rs, one) {
    // Allow for both array and iterator result sets
    const first = Array.isArray(rs) ? { done: !rs[0], value: rs[0] } : rs.next();
    if (first.done) return;
    if (one) {
      yield first.value[0];
      // Close result set to release database connection
      rs.return();
      return;
    }

    yield "[";
    // Print first value as stand alone to prevent comma check inside the loop
    yield first.value[0];
    for (const row of rs) {
      yield `,${row[0]}`;
    }
    yield "]";
  }

  async _stream(stmt, binding_params, one) {
    const columns = stmt.columns();
    // Stream single blob column
    if (columns.length === 1 && columns[0].name !== "_json_") {
      // Setting result set to raw to keep better-sqlite from doing additional processing
      stmt.raw(true);
      const rows = stmt.all(binding_params);
      // REVISIT: return undefined when no rows are found
      if (rows.length === 0) return undefined;
      if (rows[0][0] === null) return null;
      // Buffer.from only applies encoding when the input is a string
      let raw = Buffer.from(rows[0][0].toString(), "base64");
      stmt.raw(false);
      return new Readable({
        read(size) {
          if (raw.length === 0) return this.push(null);
          const chunk = raw.slice(0, size);
          raw = raw.slice(size);
          this.push(chunk);
        },
      });
    }

    stmt.raw(true);
    const rs = stmt.iterate(binding_params);
    return Readable.from(this._iterator(rs, one));
  }

  exec(sql) {
    return this.dbc.exec(sql);
  }

  static CQN2SQL = class CQN2SQLite extends lazy.SQLService.CQN2SQL {

    // Used for CREATE TABLE statements
    static TypeMap = {
      ...super.TypeMap,
      Binary: e => `VARBINARY(${e.length || 5000})`,
      LargeBinary: "LONGBLOB",
      LargeString: "LONGTEXT",
      Date: () => "DATE",
      Time: () => "TIME",
      DateTime: () => "DATETIME",
      Timestamp: () => "DATETIME",
    };

    static ReservedWords = { ...super.ReservedWords, ...MYSQL_KEYWORDS };
  };


}

