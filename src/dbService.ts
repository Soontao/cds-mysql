// @ts-nocheck
import { LRUCacheProvider } from "@newdash/newdash/cacheProvider";
import DatabaseService from "@sap/cds-runtime/lib/db/Service";
import { CSN } from "@sap/cds/apis/csn";
import cds from "@sap/cds/lib";
import { createPool, Pool } from "mysql2";
import convertAssocToOneManaged from "./convertAssocToOneManaged";
import execute from "./execute";
import localized from "./localized";

const LOG = (cds.log || cds.debug)("mysql");

export class MySQLDatabaseService extends DatabaseService {
  constructor(...args: any[]) {
    super(...args);

    // REVISIT: official db api
    this._execute = execute;

    // REVISIT: official db api
    this._insert = this._queries.insert(execute.insert);
    this._read = this._queries.read(execute.select, execute.stream);
    this._update = this._queries.update(execute.update, execute.select);
    this._delete = this._queries.delete(execute.delete);
    this._run = this._queries.run(
      this._insert,
      this._read,
      this._update,
      this._delete,
      execute.cqn,
      execute.sql
    );

    this._pools = new LRUCacheProvider<string, Pool>(1024);
  }

  private _pools: LRUCacheProvider<string, Pool>

  set model(csn: CSN) {
    const m = csn && "definitions" in csn ? cds.linked(cds.compile.for.odata(csn)) : csn;
    cds.alpha_localized(m);
    super.model = m;
  }

  init() {

    /*
     * before
     */
    this._ensureModel && this.before("*", this._ensureModel);

    this.before(["CREATE", "UPDATE"], "*", this._input);
    this.before(["CREATE", "READ", "UPDATE", "DELETE"], "*", this._rewrite);

    this.before("READ", "*", convertAssocToOneManaged);
    this.before("READ", "*", localized); // > has to run after rewrite

    // REVISIT: get data to be deleted for integrity check
    this.before("DELETE", "*", this._integrity.beforeDelete);

    /*
     * on
     */
    this.on("CREATE", "*", this._CREATE);
    this.on("READ", "*", this._READ);
    this.on("UPDATE", "*", this._UPDATE);
    this.on("DELETE", "*", this._DELETE);

    /*
     * after
     */
    // REVISIT: after phase runs in parallel -> side effects possible!
    if (this.model) {
      // REVISIT: cds.env.effective will be there with @sap/cds^4.2
      const effective = cds.env.effective || cds.env;
      if (effective.odata.structs) {
        // REVISIT: only register for entities that contain structured or navigation to it
        this.after(["READ"], "*", this._structured);
      }
      if (effective.odata.version !== "v2") {
        // REVISIT: only register for entities that contain arrayed or navigation to it
        this.after(["READ"], "*", this._arrayed);
      }
    }

    /*
     * tx
     */
    this.on(["BEGIN", "COMMIT", "ROLLBACK"], function (req) {
      return this._run(this.model, this.dbc, req.event);
    });

    // REVISIT: register only if needed?
    this.before("COMMIT", this._integrity.performCheck);

    /*
     * generic
     */
    // all others, i.e. CREATE, DROP table, ...
    this.on("*", function (req) {
      return this._run(this.model, this.dbc, req.query || req.event, req);
    });
  }

  private getPool(tenant = "default"): Pool {
    return this._pools.getOrCreate(tenant, () => {
      return createPool({ ...this.options.credentials, dateStrings: true });
    });
  }

  /*
   * connection
   */
  public async acquire(arg: any) {
    const tenant = (typeof arg === "string" ? arg : arg.user.tenant) || "default";
    const pool = this.getPool(tenant);
    const conn = await pool.promise().getConnection();
    conn._release = () => pool.releaseConnection(conn.connection);
    return conn;
  }

  public release(conn: any) {
    conn._release();
  }

  /*
   * deploy
   */
  // REVISIT: make tenant aware
  async deploy(model: import("@sap/cds/apis/csn").CSN, options: any = {}) {

    const createEntities = cds.compile.to.sql(model);
    if (!createEntities || createEntities.length === 0) return; // > nothing to deploy

    const dropViews = [];
    const dropTables = [];
    for (const each of createEntities) {
      const [, table, entity] = each.match(/^\s*CREATE (?:(TABLE)|VIEW)\s+"?([^\s(]+)"?/im) || [];
      if (table) dropTables.push({ DROP: { entity } });
      else dropViews.push({ DROP: { view: entity } });
    }

    if (options.dry) {
      const log = LOG.debug;
      for (const {
        DROP: { view }
      } of dropViews) {
        log("DROP VIEW IF EXISTS " + view + ";");
      }
      log();
      for (const {
        DROP: { entity }
      } of dropTables) {
        log("DROP TABLE IF EXISTS " + entity + ";");
      }
      log();
      for (const each of createEntities) log(each + ";\n");
      return;
    }

    const tx = this.transaction();

    // clean old tables
    await tx.run(dropViews);
    await tx.run(dropTables);

    // create new tables
    await tx.run(createEntities);
    await tx.commit();

    return true;
  }
};
