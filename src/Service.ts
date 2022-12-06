import { uniq } from "@newdash/newdash/uniq";
import {
  CSN, cwdRequire,
  cwdRequireCDS, EntityDefinition, EventContext,
  LinkedModel, Logger
} from "cds-internal-tool";
import "colors";
import { createPool, Options as PoolOptions, Pool } from "generic-pool";
import { Connection, createConnection } from "mysql2/promise";
import { AdminTool } from "./AdminTool";
import {
  CONNECTION_IDLE_CHECK_INTERVAL,
  DEFAULT_CONNECTION_ACQUIRE_TIMEOUT,
  DEFAULT_CONNECTION_IDLE_TIMEOUT,
  DEFAULT_TENANT_CONNECTION_POOL_SIZE,
  MAX_QUEUE_SIZE,
  MYSQL_COLLATE,
  TENANT_DEFAULT
} from "./constants";
import { _impl_deployment_service } from "./deploy-service";
import execute from "./execute";
import { ConnectionWithPool, MysqlDatabaseOptions } from "./types";
import { checkCdsVersion } from "./utils";

const DEFAULT_POOL_OPTIONS: Partial<PoolOptions> = {
  min: 1,
  acquireTimeoutMillis: DEFAULT_CONNECTION_ACQUIRE_TIMEOUT,
  max: DEFAULT_TENANT_CONNECTION_POOL_SIZE,
  maxWaitingClients: MAX_QUEUE_SIZE,
  evictionRunIntervalMillis: CONNECTION_IDLE_CHECK_INTERVAL,
  idleTimeoutMillis: DEFAULT_CONNECTION_IDLE_TIMEOUT,
  testOnBorrow: true,
};

/**
 * MySQL Database Adapter for SAP CAP Framework
 */
export class MySQLDatabaseService extends cwdRequire("@sap/cds/libx/_runtime/sqlite/Service") {

  constructor(...args: any[]) {
    super(...args);

    checkCdsVersion();

    const cds = cwdRequireCDS();

    // REVISIT: official db api
    this._execute = execute;

    // REVISIT: official db api
    this._insert = this._queries.insert(execute.insert);
    this._read = this._queries.read(execute.select, execute.stream);
    this._update = this._queries.update(execute.update, execute.select);
    this._delete = this._queries.delete(execute.delete, execute.update);

    this._run = this._queries.run(
      this._insert,
      this._read,
      this._update,
      this._delete,
      execute.cqn,
      execute.sql
    );

    this._logger = cds.log("db|mysql");

    if (this.options.credentials === undefined) {
      throw cds.error("mysql credentials not found");
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

  /**
   * initialize function
   */
  async init() {
    await super.init();
    this._registerEagerDeploy();
  }

  /**
   * create upsert query
   * 
   * @param entity 
   * @returns 
   */
  public upsert(entity: string | EntityDefinition) {
    return MySQLDatabaseService.UPSERT().into(entity);
  }

  private _registerEagerDeploy() {
    if (this.options?.tenant?.deploy?.auto !== false) {
      const cds = cwdRequireCDS();
      let eager = this.options.tenant?.deploy?.eager ?? [TENANT_DEFAULT];

      if (typeof eager === "string") { eager = [eager]; }

      // auth users tenants (when use basic/dummy auth)
      const tenantsFromUsers = uniq(
        Object
          .values(cds.env.get("requires.auth.users") ?? {})
          .filter((u: any) => typeof u?.tenant === "string").map((u: any) => u.tenant)
      );

      this._logger.info("tenants from users", tenantsFromUsers);

      if (tenantsFromUsers.length > 0) {
        eager.push(...tenantsFromUsers);
      }

      eager = uniq(eager) as Array<string>;

      this._logger.info("eager deploy tenants", eager);

      if (eager.length === 0) {
        return;
      }

      cds.once("served", async () => {
        return Promise.all((eager as Array<string>).map(tenant => this._initializeTenant(tenant)));
      });

    }
  }

  private async _initializeTenant(tenant: string = TENANT_DEFAULT) {
    const { "cds.xt.DeploymentService": ds } = cwdRequireCDS().services;
    if (ds === undefined) {
      await this._tool.syncTenant(tenant);
      return;
    }
    await ds.tx((tx) => tx.subscribe(
      tenant,
      { subscribedTenantId: tenant, eventType: "CREATE" }
    ));
    return;
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
      throw cwdRequireCDS().error(`tenant '${tenant}' database is not found, maybe forgot to setup?`);
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
  public async acquire(tenant_id: string): Promise<ConnectionWithPool>;

  public async acquire(context: EventContext): Promise<ConnectionWithPool>;

  public async acquire(arg: any) {
    const tenant = (typeof arg === "string" ? arg : arg?.user?.tenant) ?? TENANT_DEFAULT;
    const pool = await this.getPool(tenant);
    // REVISIT: priority maybe for http request
    // REVISIT: retry connection
    const conn = await pool.acquire();
    return Object.assign(conn, { _pool: pool });
  }

  /**
   * release connection to pool
   *
   * @param conn
   * @override
   */
  public async release(conn: ConnectionWithPool) {
    if (typeof conn?._pool?.release === "function") {
      await conn._pool.release(conn);
    }
  }


  /**
   * disconnect from database, free all connections of all tenants
   * 
   * @param tenant optional tenant id, if with `*`, close all pools 
   */
  public async disconnect(tenant: "*" | string = TENANT_DEFAULT) {
    if (tenant !== "*") {
      if (this._pools.has(tenant)) {
        this._logger.info("disconnect mysql database for tenant", tenant.green);
        const pool = await this._pools.get(tenant);
        this._pools.delete(tenant);
        await pool.drain();
        await pool.clear();
      }
      return;
    }

    this._logger.info("disconnect mysql database for all tenants");
    const pools = await Promise.all(Array.from(this._pools.values()).map(async pool => await pool));
    this._pools.clear();
    await Promise.all(
      pools.map(async pool => {
        await pool.drain();
        await pool.clear();
      })
    );

  }

  /**
   * deploy CSV only
   * 
   * @param tenant 
   * @returns 
   */
  public deployCSV(tenant?: string, csvList?: Array<string>) {
    this._logger.debug("deploy csv for tenant", tenant, "with csv", csvList);
    return this._tool.deployCSV(tenant, csvList);
  }

  /**
   * implement deployment service
   * 
   * @internal
   * @param ds 
   * @returns 
   */
  public implDeploymentService(ds: any) {
    return _impl_deployment_service(ds);
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
