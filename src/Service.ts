import { cloneDeep } from "@newdash/newdash";
import { cwdRequire, cwdRequireCDS, EventContext, LinkedModel, Logger } from "cds-internal-tool";
import { createPool, Pool } from "generic-pool";
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
import { csnToEntity, migrate, migrateData } from "./typeorm";
import { checkCdsVersion } from "./utils";

/**
 * raw mysql2 library required credential
 */
interface MySQLCredential {
  /**
   * DB User Name
   */
  user: string;
  /**
   * DB Password
   */
  password?: string;
  /**
   * DB Database/Schema Name, default same with user name
   */
  database?: string;
  /**
   * DB HostName, default localhost
   */
  host?: string;
  /**
   * DB Connection Port, default 3306
   */
  port?: string | number;

  ssl?: {
    /**
     * SSL ca cert in PEM text format 
     */
    ca?: string;
  }
}

type RleaseableConnection = Connection & {
  _release: () => void;
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
  }

  private options: any;

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
            const credential = await this.getTenantCredential(tenant);

            await this.deploy(await cwdRequireCDS().load(this.model["$sources"]), { tenant });

            const poolOptions = {
              min: 1,
              max: DEFAULT_TENANT_CONNECTION_POOL_SIZE,
              maxWaitingClients: MAX_QUEUE_SIZE,
              evictionRunIntervalMillis: CONNECTION_IDLE_CHECK_INTERVAL,
              idleTimeoutMillis: DEFAULT_CONNECTION_IDLE_TIMEOUT,
              ...this.options?.pool // overwrite by cds
            };

            this._logger.info("creating pool for tenant", tenant, "with option", poolOptions);

            return createPool(
              {
                create: () => createConnection({ ...credential, dateStrings: true, charset: MYSQL_COLLATE } as any),
                validate: (conn) => conn.query("SELECT 1").then(() => true).catch(() => false),
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


  private _getTenantDatabaseName(tenant: string) {
    const credential: MySQLCredential = cloneDeep(this.options.credentials);
    if (tenant === TENANT_DEFAULT) {
      return credential.database ?? credential.user;
    }
    const cds = cwdRequireCDS();
    const tenant_db_prefix = cds.env.get("requires.mysql.tenant_prefix") ?? "tenant_db";
    const candidate_name = `${tenant_db_prefix}_${tenant}`;
    const final_name = candidate_name.replace(/[\W_]+/g, "");
    return final_name;
  }

  /**
   * overwrite this method to provide different databases for different tenants
   *
   * @param tenant
   */
  private async getTenantCredential(tenant?: string): Promise<MySQLCredential> {
    const rt: MySQLCredential = cloneDeep(this.options.credentials);
    rt.database = this._getTenantDatabaseName(tenant);
    return rt;
  }

  /**
   * acquire connection from pool
   *
   * @override
   * @param tenant_id tenant id
   */
  public async acquire(tenant_id: string): Promise<RleaseableConnection>;

  public async acquire(context: EventContext): Promise<RleaseableConnection>;

  public async acquire(arg: any) {
    const tenant = (typeof arg === "string" ? arg : arg.user.tenant) || TENANT_DEFAULT;
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
    const credentials = await this.getTenantCredential(tenant);
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
   * create tenant database 
   * 
   * @param tenant tenant id, if `undefined`, will skip 
   * @returns 
   */
  private async _createDatabaseForTenant(tenant?: string) {
    if (tenant === undefined || tenant === TENANT_DEFAULT) {
      this._logger.debug("default tenant, skip creation database");
      return;
    }

    const defaultConnection = await this.acquire(TENANT_DEFAULT);

    try {
      await defaultConnection.query(`CREATE DATABASE IF NOT EXISTS \`${this._getTenantDatabaseName(tenant)}\``);
    }
    finally {
      defaultConnection._release();
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
        await this._createDatabaseForTenant(tenant);
      }
      const entities = csnToEntity(model);
      const migrateOptions = await this._getTypeOrmOption(tenant);
      await migrate({ ...migrateOptions, entities });
      if (this.options?.csv?.migrate !== false) {
        await migrateData(this, model);
      }
      else {
        this._logger.debug("csv migration disabled");
      }
      this._logger.info("migrate finished for tenant", tenant);
      return true;
    } catch (error) {
      this._logger.info("migrate failed for tenant", tenant, error);
      throw error;
    }
  }
}
