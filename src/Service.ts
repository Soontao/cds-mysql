import "colors";
import { CSN, cwdRequire, cwdRequireCDS, EventContext, LinkedModel, Logger, memorized } from "cds-internal-tool";
import { createPool, Pool, Options as PoolOptions } from "generic-pool";
import { Connection, createConnection } from "mysql2/promise";
import type { DataSourceOptions } from "typeorm";
import {
  CONNECTION_IDLE_CHECK_INTERVAL,
  DEFAULT_CONNECTION_IDLE_TIMEOUT,
  DEFAULT_TENANT_CONNECTION_POOL_SIZE,
  MAX_QUEUE_SIZE,
  MYSQL_COLLATE,
  TENANT_DEFAULT
} from "./constants";
import execute from "./execute";
import { csnToEntity, migrate } from "./typeorm";
import { migrateData } from "./typeorm/migrate";
import { checkCdsVersion } from "./utils";
import { MySQLCredential, ReleasableConnection } from "./types";
import { ShareMysqlTenantProvider, TenantProvider } from "./tenant";

const DEFAULT_POOL_OPTIONS: Partial<PoolOptions> = {
  min: 1,
  max: DEFAULT_TENANT_CONNECTION_POOL_SIZE,
  maxWaitingClients: MAX_QUEUE_SIZE,
  evictionRunIntervalMillis: CONNECTION_IDLE_CHECK_INTERVAL,
  idleTimeoutMillis: DEFAULT_CONNECTION_IDLE_TIMEOUT,
};

const _rawCSN = memorized(async (m: LinkedModel) => {
  return await cwdRequireCDS().load(m["$sources"]);
});

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

    this._tenantProvider = new ShareMysqlTenantProvider(this); // TODO: extract to options
  }

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

  private _tenantProvider: TenantProvider;

  async init() {
    await super.init();
    if (this.options?.tenant?.deploy?.auto !== false) {
      const eager = this.options.tenant?.deploy?.eager;
      if (typeof eager === "string") {
        await this.getPool(eager);
      }
      if (eager instanceof Array) {
        for (const eagerDeployTenant of eager) {
          if (typeof eagerDeployTenant === "string") {
            await this.getPool(eagerDeployTenant);
          }
          else {
            this._logger.warn(
              "for 'tenant.deploy.eager' options",
              "the value must be string or array of string",
              "the value", eagerDeployTenant, "is not supported"
            );
          }
        }
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

    if (!this._pools.has(tenant)) {

      this._pools.set(tenant,
        (
          async () => {
            const credential = await this._tenantProvider.getCredential(tenant);
            const poolOptions = { ...DEFAULT_POOL_OPTIONS, ...this.options?.pool }; // TODO: pool configuration provider
            const tenantCredential = { ...credential, dateStrings: true, charset: MYSQL_COLLATE };

            if (this.options?.tenant?.deploy?.auto !== false) {
              // TODO: tenant model
              await this.deploy(await _rawCSN(this.model), { tenant });
              if (this.options?.csv?.migrate !== false) {
                await migrateData(tenantCredential, this.model);
              }
              else {
                this._logger.debug("csv migration disabled, skip migrate CSV for tenant", tenant);
              }

            }
            else {
              this._logger.debug("auto tenant deploy disabled, skip auto deploy for tenant", tenant);
            }

            this._logger.info("creating connection pool for tenant", tenant, "with option", poolOptions);

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
        )().then(pool => { this._pools.set(tenant, pool); return pool; })
      );


    }

    return await this._pools.get(tenant);

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
   * get type orm option for migration or other usage
   * @param tenant 
   * @returns 
   */
  private async _getTypeOrmOption(tenant: string = TENANT_DEFAULT): Promise<DataSourceOptions> {
    const credentials = await this._tenantProvider.getCredential(tenant);
    return Object.assign(
      {},
      {
        name: `cds-deploy-connection-${tenant ?? "main"}`,
        type: "mysql",
        entities: []
      },
      credentials,
      {
        // typeorm need the 'username' field as username
        username: credentials.user
      }
    ) as any;
  }

  /**
   * disconnect from database, free all connections of all tenants
   */
  public async disconnect() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [tenant, pool] of this._pools.entries()) {
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
    const tenant = options?.tenant ?? TENANT_DEFAULT;
    try {
      this._logger.info("migrating schema for tenant", tenant.green);
      if (tenant !== TENANT_DEFAULT) {
        await this._tenantProvider.createDatabase(tenant);
      }
      const entities = csnToEntity(model);
      const migrateOptions = await this._getTypeOrmOption(tenant);
      await migrate({ ...migrateOptions, entities });
      this._logger.info("migrate", "successful".green, "for tenant", tenant.green);
      return true;
    } catch (error) {
      this._logger.info("migrate", "failed".red, "for tenant", tenant.red, error);
      throw error;
    }
  }
}
