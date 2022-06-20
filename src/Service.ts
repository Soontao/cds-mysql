import { cwdRequire, cwdRequireCDS, EventContext, LinkedModel, Logger } from "cds-internal-tool";
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

  private options: {
    /**
     * database credentials
     */
    credentials: MySQLCredential;
    /**
     * tenant configuration
     */
    tenant?: {
      prefix?: string;
      auto?: boolean;
    };
    /**
     * connection pool options
     */
    pool?: PoolOptions;
    csv?: {
      /**
       * migrate CSV on deployment
       */
      migrate?: boolean;
    }
  };

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
            const poolOptions = { ...DEFAULT_POOL_OPTIONS, ...this.options?.pool }; // TODO: pool configuratino provider
            const tenantCredential = { ...credential, dateStrings: true, charset: MYSQL_COLLATE };

            if (this.options?.tenant?.auto !== false) {
              const tenantModel = await cwdRequireCDS().load(this.model["$sources"]);
              await this.deploy(tenantModel, { tenant });

              if (this.options?.csv?.migrate !== false) {
                await migrateData(tenantCredential, tenantModel);
              }
              else {
                this._logger.debug("csv migration disabled, skip migrate CSV for tenant", tenant);
              }

            }
            else {
              this._logger.debug("auto tenant deploy disabled, skip auto deploy for tenant", tenant);
            }

            this._logger.info("creating connection pool for tenant", tenant, "with option", poolOptions);

            return createPool(
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
          }
        )()
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
   * dis connect from database, free all connections of all tenants
   */
  public async disconnect() {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [tenant, pool] of this._pools.entries()) {
      await (await pool).clear();
    }
  }


  /**
   * 
   * @param model plain CSN object
   * @param options deployment options
   * @returns 
   */
  async deploy(model: LinkedModel, options?: { tenant: string }) {
    const tenant = options?.tenant ?? TENANT_DEFAULT;
    try {
      this._logger.info("migrating schema for tenant", tenant);
      if (tenant !== TENANT_DEFAULT) {
        await this._tenantProvider.createDatabase(tenant);
      }
      const entities = csnToEntity(model);
      const migrateOptions = await this._getTypeOrmOption(tenant);
      await migrate({ ...migrateOptions, entities });
      this._logger.info("migrate finished for tenant", tenant);
      return true;
    } catch (error) {
      this._logger.info("migrate failed for tenant", tenant, error);
      throw error;
    }
  }
}
