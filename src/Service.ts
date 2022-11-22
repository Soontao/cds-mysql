import { uniq } from "@newdash/newdash/uniq";
import { CSN, cwdRequire, cwdRequireCDS, EntityDefinition, EventContext, LinkedModel, Logger } from "cds-internal-tool";
import "colors";
import { createPool, Options as PoolOptions, Pool } from "generic-pool";
import { Connection, createConnection } from "mysql2/promise";
import { AdminTool } from "./AdminTool";
import {
  CONNECTION_IDLE_CHECK_INTERVAL,
  DEFAULT_CONNECTION_IDLE_TIMEOUT,
  DEFAULT_TENANT_CONNECTION_POOL_SIZE,
  MAX_QUEUE_SIZE,
  MYSQL_COLLATE,
  TENANT_DEFAULT
} from "./constants";
import execute from "./execute";
import { MySQLCredential, ReleasableConnection } from "./types";
import { checkCdsVersion } from "./utils";

const DEFAULT_POOL_OPTIONS: Partial<PoolOptions> = {
  min: 1,
  max: DEFAULT_TENANT_CONNECTION_POOL_SIZE,
  maxWaitingClients: MAX_QUEUE_SIZE,
  evictionRunIntervalMillis: CONNECTION_IDLE_CHECK_INTERVAL,
  idleTimeoutMillis: DEFAULT_CONNECTION_IDLE_TIMEOUT,
  testOnBorrow: true,
};


export interface MysqlDatabaseOptions {
  /**
   * database credentials
   */
  credentials: MySQLCredential;
  /**
   * tenant configuration
   */
  tenant?: {
    deploy?: {
      /**
       * auto migrate database schema when connect to it (create pool),
       * 
       * default `true`
       */
      auto?: boolean;
      /**
       * eager deploy tenant id list 
       * 
       * schema sync of these tenants will be performed when server startup
       * 
       * default value is ['default']
       */
      eager?: Array<string> | string;
    };
    /**
     * tenant database name prefix
     */
    prefix?: string;
  };
  /**
   * connection pool options for each tenant
   */
  pool?: PoolOptions;
  csv?: {
    /**
     * migrate CSV on deployment
     * 
     * default value `true`
     */
    migrate?: boolean;
  };
}

/**
 * MySQL Database Adapter for SAP CAP Framework
 */
export class MySQLDatabaseService extends cwdRequire("@sap/cds/libx/_runtime/sqlite/Service") {

  constructor(...args: any[]) {
    super(...args);

    checkCdsVersion();

    // REVISIT: official db api
    this._execute = execute;

    // REVISIT: official db api
    this._insert = this._queries.insert(execute.insert);
    this._read = this._queries.read(execute.select, execute.stream);
    this._update = this._queries.update(execute.update, execute.select);
    this._delete = this._queries.delete(execute.delete, execute.update);
    this._run = this._queries.run(this._insert, this._read, this._update, this._delete, execute.cqn, execute.sql);

    this._logger = cwdRequireCDS().log("db|mysql");

    if (this.options.credentials === undefined) {
      throw new Error("mysql credentials lost");
    }

    this._tool = new AdminTool();
  }

  private _tool: AdminTool;

  private options: MysqlDatabaseOptions;

  private model: LinkedModel;

  private _queries: any;

  private _execute: any;

  private _read: any;

  private _insert: any;

  private _update: any;

  private _delete: any;

  private _run: any;

  private _logger: Logger;

  private _pools: Map<string, Pool<Connection> | Promise<Pool<Connection>>> = new Map();

  /**
   * create upsert query
   * 
   */
  public static UPSERT(): import("./types").UPSERT {
    const i = cwdRequireCDS().ql.INSERT();
    i.INSERT["_upsert"] = true;
    return i;
  };

  async init() {
    await super.init();
    this._registerEagerDeploy();
  }

  public upsert(entity: string | EntityDefinition) {
    return MySQLDatabaseService.UPSERT().into(entity);
  }

  private _registerEagerDeploy() {
    if (this.options?.tenant?.deploy?.auto !== false) {
      const cds = cwdRequireCDS();
      let eager = this.options.tenant?.deploy?.eager ?? [TENANT_DEFAULT];

      if (typeof eager === "string") { eager = [eager]; }

      // auth users tenants (when use basic/dummy auth)
      const tenantsFromUsers = Object
        .values(cds.env.get("requires.auth.users") ?? {})
        .filter((u: any) => typeof u?.tenant === "string").map((u: any) => u.tenant);

      this._logger.info("tenants from users", tenantsFromUsers);

      if (tenantsFromUsers.length > 0) {
        eager.push(...tenantsFromUsers);
      }

      eager = uniq(eager);

      this._logger.info("eager deploy tenants", eager);

      if (eager.length > 0) {
        cds.once("served", async () => {
          const { "cds.xt.DeploymentService": ds } = cds.services;
          for (const tenant of eager) {
            if (ds !== undefined) {
              await ds.tx((tx: any) => tx.subscribe(
                tenant,
                {
                  subscribedTenantId: tenant,
                  eventType: "CREATE"
                }
              ));
            }
            else {
              await this._tool.syncTenant(tenant);
            }

          }
        });
      }


    }
  }

  /**
   * get connection pool for tenant
   *
   * connection pool is independent for tenant
   *
   * @param tenant
   */
  private async getPool(tenant = TENANT_DEFAULT): Promise<Pool<Connection>> {
    if (!(await this._tool.hasTenantDatabase(tenant))) {
      this._logger.error(
        "tenant", tenant,
        "is not found in database, did you forgot to subscribe that?"
      );
      throw cwdRequireCDS()["error"]("tenant not found", tenant);
    }
    if (!this._pools.has(tenant)) {
      this._pools.set(
        tenant,
        this._createPoolFor(tenant).then(
          pool => { this._pools.set(tenant, pool); return pool; }
        )
      );
    }

    return await this._pools.get(tenant);

  }

  private async _createPoolFor(tenant?: string) {
    const credential = this._tool.getMySQLCredential(tenant);

    const poolOptions = {
      ...DEFAULT_POOL_OPTIONS,
      ...this.options?.pool
    };

    const tenantCredential = {
      ...credential,
      dateStrings: true,
      charset: MYSQL_COLLATE
    };

    this._logger.info(
      "creating connection pool for tenant",
      tenant,
      "with option",
      poolOptions
    );

    const newPool = createPool(
      {
        create: () => createConnection(tenantCredential as any),
        validate: (conn) => conn
          .query("SELECT 1")
          .then(() => true)
          .catch((err) => {
            this._logger.error("validate connection failed:", err);
            return false;
          }),
        destroy: async (conn) => {
          await conn.end();
        }
      },
      poolOptions,
    );
    return newPool;
  }

  /**
   * acquire connection from pool
   *
   * @override
   * @param tenant_id tenant id
   */
  public async acquire(tenant_id: string): Promise<ReleasableConnection>;

  public async acquire(context: EventContext): Promise<ReleasableConnection>;

  public async acquire(arg: any) {
    const tenant = (typeof arg === "string" ? arg : arg?.user?.tenant) ?? TENANT_DEFAULT;
    const pool = await this.getPool(tenant);
    const conn = await pool.acquire();
    conn["_release"] = () => pool.release(conn);
    return conn;
  }

  /**
   * release connection to pool
   *
   * @param conn
   * @override
   */
  public async release(conn: any) {
    if (conn._release && typeof conn._release === "function") {
      await conn._release();
    }
  }


  /**
   * disconnect from database, free all connections of all tenants
   * 
   * @param tenant optional tenant id, if without that, close all pools 
   */
  public async disconnect(tenant?: string) {
    if (tenant !== undefined) {
      if (this._pools.has(tenant)) {
        this._logger.info("disconnect mysql database for tenant", tenant);
        const pool = await this._pools.get(tenant);
        await pool.clear();
      }
      return;
    }
    this._logger.info("disconnect mysql database for all tenants");
    for (const pool of this._pools.values()) {
      await (await pool).clear();
    }

  }


  /**
   * deploy (migrate) schema to (tenant) database
   * 
   * @param model plain CSN object
   * @param options deployment options
   * @returns 
   */
  async deploy(model: CSN, options?: { tenant: string }) {
    await this._tool.deploy(model, options?.tenant);
  }

  /**
   * get db admin tool
   * 
   * @returns 
   */
  public getAdminTool() {
    return this._tool;
  }

}
