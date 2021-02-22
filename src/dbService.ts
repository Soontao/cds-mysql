// @ts-nocheck
import { LRUCacheProvider } from "@newdash/newdash/cacheProvider";
import DatabaseService from "@sap/cds-runtime/lib/db/Service";
import cds from "@sap/cds/lib";
import { createPool, Pool } from "mysql2";
import { ConnectionOptions } from "typeorm";
import { TENANT_DEFAULT } from "./constants";
import convertAssocToOneManaged from "./convertAssocToOneManaged";
import execute from "./execute";
import localized from "./localized";
import { csnToEntity, migrate } from "./typeorm";

const LOG = (cds.log || cds.debug)("mysql");


interface MySQLCredential {
  /**
   * DB User Name
   */
  user: string,
  /**
   * DB Password
   */
  password?: string,
  /**
   * DB Database/Schema Name, default same with user name
   */
  database?: string,
  /**
   * DB HostName, default localhost
   */
  host?: string;
  /**
   * DB Connection Port, default 3306
   */
  port?: string | number;
}

/**
 * MySQL Database Adapter for SAP CAP Framework
 */
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

  set model(csn) {
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

  /**
   * get connection pool for tenant
   * 
   * @param tenant 
   */
  private async getPool(tenant = TENANT_DEFAULT): Promise<Pool> {
    return this._pools.getOrCreate(tenant, async () => {
      const credential = await this.getTenantCredential(tenant);
      return createPool({ ...credential, dateStrings: true });
    });
  }

  /**
   * overwrite this method to provide different databases for different tenants
   * 
   * @param tenant 
   */
  private async getTenantCredential(tenant?: string): Promise<MySQLCredential> {
    // TODO, leave an enhance point for user
    return this.options.credentials;
  }

  /**
   * acquire connection from pool
   * 
   * @override
   * @param arg 
   */
  public async acquire(arg: any) {
    const tenant = (typeof arg === "string" ? arg : arg.user.tenant) || TENANT_DEFAULT;
    const pool = await this.getPool(tenant);
    const conn = await pool.promise().getConnection();
    conn._release = () => pool.releaseConnection(conn.connection);
    return conn;
  }

  /**
   * release connection to pool
   * 
   * @param conn 
   * @override
   */
  public release(conn: any) {
    if (conn._release && typeof conn._release === "function") {
      conn._release();
    }
  }

  private async _getTypeOrmOption(tenant?: string): Promise<ConnectionOptions> {
    const credentials = await this.getTenantCredential(tenant);
    return {
      name: "cds-deploy-connection",
      type: "mysql",
      username: credentials.user,
      password: credentials.password,
      database: credentials.database ?? credentials.user,
      host: credentials.host,
      port: parseInt(credentials.port) ?? 3306,
      entities: []
    };

  }

  /*
   * deploy
   */
  async deploy(model: any, options: any = {}) {
    const entities = csnToEntity(model);
    const migrateOptions = await this._getTypeOrmOption(options?.tenant ?? TENANT_DEFAULT);
    await migrate({ ...migrateOptions, entities });
    return true;
  }

};
